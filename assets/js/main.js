/* Work Beyond Borders — site behaviour */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- header: solid once scrolled past the hero top ---------- */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- mobile nav ---------- */
  var toggle = document.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = root.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.querySelectorAll('.nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        root.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------- reveal on scroll ---------- */
  var targets = document.querySelectorAll('.reveal');
  if (targets.length) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      targets.forEach(function (t) { io.observe(t); });
    } else {
      targets.forEach(function (t) { t.classList.add('is-in'); });
    }
  }

  /* ---------- careers accordion ---------- */
  var roles = document.querySelectorAll('.role');
  roles.forEach(function (role) {
    var btn = role.querySelector('.role__btn');
    var panel = role.querySelector('.role__panel');
    if (!btn || !panel) return;

    btn.addEventListener('click', function () {
      var willOpen = !role.classList.contains('is-open');
      roles.forEach(function (other) {
        other.classList.remove('is-open');
        var b = other.querySelector('.role__btn');
        var p = other.querySelector('.role__panel');
        if (b) b.setAttribute('aria-expanded', 'false');
        if (p) p.setAttribute('aria-hidden', 'true');
      });
      if (willOpen) {
        role.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        panel.setAttribute('aria-hidden', 'false');
      }
    });
  });

  /* ---------- photo rails ---------- */
  document.querySelectorAll('.rail').forEach(function (rail) {
    var track = rail.querySelector('.rail__track');
    if (!track) return;

    var step = function () {
      var first = track.querySelector('img');
      return first ? first.getBoundingClientRect().width + 14 : 240;
    };

    rail.querySelectorAll('.rail__btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dir = btn.classList.contains('rail__btn--prev') ? -1 : 1;
        track.scrollBy({ left: dir * step() * 2, behavior: 'smooth' });
      });
    });

    var sync = function () {
      var max = track.scrollWidth - track.clientWidth - 2;
      var prev = rail.querySelector('.rail__btn--prev');
      var next = rail.querySelector('.rail__btn--next');
      if (prev) prev.style.opacity = track.scrollLeft <= 2 ? '.35' : '1';
      if (next) next.style.opacity = track.scrollLeft >= max ? '.35' : '1';
    };
    sync();
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
  });

  /* ---------- video explainer: inline player + first-visit popup ---------- */
  var SEEN_KEY = 'wbb:explainer-seen';
  var calmed = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function remember(key) { try { localStorage.setItem(key, '1'); } catch (e) {} }
  function remembered(key) { try { return localStorage.getItem(key) === '1'; } catch (e) { return false; } }

  /* Gives one .vplayer frame its poster/play/sound behaviour and hands back a
     small API so the popup can drive its own copy. */
  function wirePlayer(frame) {
    var video = frame && frame.querySelector('video');
    if (!video) return null;

    var playBtn = frame.querySelector('.vplayer__play');
    var soundBtn = frame.querySelector('.vplayer__sound');

    function hideSoundNudge() {
      if (soundBtn) soundBtn.hidden = true;
    }

    /* Start with sound. Browsers reject an unmuted play() that no click asked
       for, so fall back to a muted run and invite the visitor to switch it on. */
    function start(withSound) {
      if (video.ended) video.currentTime = 0;
      video.muted = !withSound;
      var attempt = video.play();

      if (attempt && typeof attempt.catch === 'function') {
        attempt.then(function () {
          video.controls = true;
          if (withSound) hideSoundNudge();
          else if (soundBtn) soundBtn.hidden = false;
        }).catch(function () {
          if (!withSound) return;          // muted run already failed; leave the poster up
          video.muted = true;
          var muteRun = video.play();
          if (muteRun && typeof muteRun.catch === 'function') muteRun.catch(function () {});
          video.controls = true;
          if (soundBtn) soundBtn.hidden = false;
        });
      } else {
        video.controls = true;
      }
    }

    if (playBtn) {
      playBtn.addEventListener('click', function () {
        hideSoundNudge();
        start(true);                        // a real click, so sound is allowed
      });
    }

    if (soundBtn) {
      soundBtn.addEventListener('click', function () {
        video.muted = false;
        video.volume = 1;
        hideSoundNudge();
        var p = video.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      });
    }

    video.addEventListener('playing', function () { frame.classList.add('is-playing'); });
    video.addEventListener('ended', function () {
      frame.classList.remove('is-playing');
      video.controls = false;
      hideSoundNudge();
    });

    return {
      video: video,
      autostart: function () { start(true); },
      stop: function () {
        video.pause();
        video.currentTime = 0;
        video.controls = false;
        frame.classList.remove('is-playing');
        hideSoundNudge();
      }
    };
  }

  var inline = wirePlayer(document.querySelector('.explainer .vplayer'));

  /* ---------- the popup itself ---------- */
  var modal = document.getElementById('explainer-modal');
  if (modal) {
    var popup = wirePlayer(modal.querySelector('.vplayer'));
    var closers = modal.querySelectorAll('[data-close-modal]');
    var focusBack = null;
    var open = false;

    function focusables() {
      return Array.prototype.filter.call(
        modal.querySelectorAll('button,[href],video[controls]'),
        function (el) { return el.offsetParent !== null || el === document.activeElement; }
      );
    }

    function openModal() {
      if (open) return;
      open = true;
      focusBack = document.activeElement;
      root.classList.add('vmodal-open');
      modal.classList.add('is-open');
      modal.removeAttribute('aria-hidden');
      remember(SEEN_KEY);                   // seen once, never nagged again

      var first = modal.querySelector('.vmodal__close');
      if (first) first.focus();

      /* Auto-rolling video is motion the visitor did not ask for, so when they
         have asked for less of it the popup waits behind its play button. */
      if (popup && !calmed) popup.autostart();
    }

    function closeModal() {
      if (!open) return;
      open = false;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      root.classList.remove('vmodal-open');
      if (popup) popup.stop();
      if (focusBack && typeof focusBack.focus === 'function') focusBack.focus();
    }

    Array.prototype.forEach.call(closers, function (el) {
      el.addEventListener('click', closeModal);
    });

    // clicking the dark surround closes; clicking the dialog does not
    modal.addEventListener('mousedown', function (e) {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', function (e) {
      if (!open) return;
      if (e.key === 'Escape') { closeModal(); return; }
      if (e.key !== 'Tab') return;

      var items = focusables();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // first visit only, and only once the page itself has had a moment to land
    if (!remembered(SEEN_KEY)) {
      window.setTimeout(openModal, 1200);
    }

    // watching it inline should never be interrupted by the popup
    if (inline) {
      inline.video.addEventListener('play', function () {
        if (open) closeModal();
      });
    }
  }

})();

/* ---------- reels carousel ---------- */
(function () {
  'use strict';
  var track = document.querySelector('.reels__track');
  if (!track) return;

  var reels = Array.prototype.slice.call(track.querySelectorAll('.reel'));
  var arrows = document.querySelectorAll('.reels__arrow');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ICON_MUTED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>';
  var ICON_SOUND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>';

  function setSound(reel, on) {
    var v = reel.querySelector('video');
    v.muted = !on;
    reel.classList.toggle('is-unmuted', on);
    var btn = reel.querySelector('.reel__sound');
    btn.innerHTML = on ? ICON_SOUND : ICON_MUTED;
    btn.setAttribute('aria-label', on ? 'Mute video' : 'Unmute video');
  }

  function play(reel) {
    var p = reel.querySelector('video').play();
    if (p && p.catch) p.catch(function () {});
    reel.classList.remove('is-paused');
  }

  function pause(reel) {
    reel.querySelector('video').pause();
    reel.classList.add('is-paused');
  }

  reels.forEach(function (reel) {
    var sound = document.createElement('button');
    sound.type = 'button';
    sound.className = 'reel__sound';
    reel.appendChild(sound);

    var badge = document.createElement('span');
    badge.className = 'reel__play';
    badge.setAttribute('aria-hidden', 'true');
    badge.innerHTML = ICON_PLAY;
    reel.appendChild(badge);

    setSound(reel, false);
    reel.classList.add('is-paused');

    // Match the card to the video's real shape once its size is known.
    var vid = reel.querySelector('video');
    function fit() {
      if (vid.videoWidth) reel.style.setProperty('--ar', vid.videoWidth + '/' + vid.videoHeight);
      updateArrows();
    }
    if (vid.readyState >= 1) fit(); else vid.addEventListener('loadedmetadata', fit);

    // Sound button: only one reel plays audio at a time.
    sound.addEventListener('click', function (e) {
      e.stopPropagation();
      var turnOn = !reel.classList.contains('is-unmuted');
      reels.forEach(function (r) { if (r !== reel) setSound(r, false); });
      setSound(reel, turnOn);
      if (turnOn) play(reel);
    });

    // Tapping the video itself toggles play / pause.
    reel.addEventListener('click', function () {
      if (reel.querySelector('video').paused) play(reel); else pause(reel);
    });
  });

  // Autoplay (muted) only while a reel is mostly on screen; pause otherwise.
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) play(e.target);
        else { pause(e.target); setSound(e.target, false); }
      });
    }, { threshold: 0.6 });
    reels.forEach(function (r) { io.observe(r); });
  }

  // Arrows scroll by most of a screen; scroll-snap lands on the nearest card.
  function step() { return track.clientWidth * 0.75; }
  function updateArrows() {
    var max = track.scrollWidth - track.clientWidth - 2;
    arrows[0].disabled = track.scrollLeft <= 2;
    arrows[1].disabled = track.scrollLeft >= max;
  }
  arrows.forEach(function (a) {
    a.addEventListener('click', function () {
      track.scrollBy({ left: step() * Number(a.dataset.dir), behavior: 'smooth' });
    });
  });
  track.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  updateArrows();
})();

/* ---------- popup dialogs -------------------------------------------------
   Two of them, and they work the same way: the "Contact us" popup in the
   header of every page, and the "Apply for this role" popup on Careers.

   Both hold an embedded GoHighLevel form, which is a cross-origin iframe. It
   validates itself, posts to GHL from inside that frame, and creates the
   contact or the application there. None of it passes through this file, and
   nothing here can reach into the frame to help or interfere.

   So this module is only the dialogs around them: open, close, the focus
   trap, Escape. If an embed fails to load the popup still opens, on an empty
   panel -- the honest failure rather than a dead button.
-------------------------------------------------------------------------- */
(function () {
  'use strict';

  var root = document.documentElement;
  var live = null;                       // only one dialog is ever open

  function wire(modal, closeSelector) {
    if (!modal) return null;

    var focusBack = null;
    var isOpen = false;

    function focusables() {
      return Array.prototype.filter.call(
        modal.querySelectorAll('button,[href],input:not([tabindex="-1"]),textarea,iframe'),
        function (el) { return !el.disabled && el.offsetParent !== null; }
      );
    }

    function open() {
      if (isOpen) return;
      if (live && live !== api) live.close();
      isOpen = true;
      live = api;
      focusBack = document.activeElement;
      root.classList.add('cmodal-open');
      modal.classList.add('is-open');
      modal.removeAttribute('aria-hidden');
      /* the embed owns its own fields and this document cannot focus into
         another origin, so focus lands on the close button -- never left
         behind on the page underneath, which is what traps a keyboard user */
      var first = modal.querySelector('.cmodal__close');
      if (first) window.setTimeout(function () { first.focus(); }, 60);
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      if (live === api) live = null;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      root.classList.remove('cmodal-open');
      if (focusBack && typeof focusBack.focus === 'function') focusBack.focus();
    }

    var api = { open: open, close: close, isOpen: function () { return isOpen; } };

    Array.prototype.forEach.call(modal.querySelectorAll(closeSelector), function (btn) {
      btn.addEventListener('click', close);
    });

    // clicking the dark surround closes; clicking the dialog does not
    modal.addEventListener('mousedown', function (e) {
      if (e.target === modal) close();
    });

    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var items = focusables();
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    return api;
  }

  /* ---------- contact ---------- */
  var contact = wire(document.getElementById('contact-modal'), '[data-close-contact]');
  if (contact) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-open-contact]'), function (btn) {
      btn.addEventListener('click', function () { contact.open(); });
    });
  }

  /* ---------- apply for a role ----------
     One dialog serves all six roles. Which role was clicked is carried on the
     button and passed to the form as a query parameter, which GHL reads to
     preselect its "Position applying for" field -- so nobody has to tell us
     twice which job they are applying for.

     The iframe has no src until the dialog is first opened. A careers page
     that silently downloaded a form nobody asked for would cost every visitor
     the weight of it just for reading the job descriptions. */
  var applyModal = document.getElementById('apply-modal');
  var apply = wire(applyModal, '[data-close-apply]');
  if (apply) {
    var frame   = applyModal.querySelector('iframe');
    var heading = applyModal.querySelector('[data-apply-role]');
    var base    = frame.getAttribute('data-src');
    var key     = frame.getAttribute('data-role-field');
    var loaded  = null;

    Array.prototype.forEach.call(document.querySelectorAll('[data-open-apply]'), function (btn) {
      btn.addEventListener('click', function () {
        var role = btn.getAttribute('data-role') || '';
        if (heading) heading.textContent = role;
        // reloading the frame resets a part-filled form, so only on a new role
        if (base && role !== loaded) {
          frame.src = base + (key ? '?' + encodeURIComponent(key) + '=' + encodeURIComponent(role) : '');
          loaded = role;
        }
        apply.open();
      });
    });
  }
})();

/* ---------- case study: creator video rail ----------------------------
   Four real campaign videos. Each tile is a poster until it is asked for,
   so the page costs four JPEGs to read and only downloads an mp4 on a
   deliberate click. One plays at a time.
---------------------------------------------------------------------- */
(function () {
  'use strict';

  var tiles = document.querySelectorAll('.cs-creator[data-video]');
  if (!tiles.length) return;

  var playing = null;

  function build(tile) {
    var existing = tile.querySelector('video');
    if (existing) return existing;

    var v = document.createElement('video');
    v.src = tile.getAttribute('data-video');
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.loop = true;
    v.muted = true;
    // Chrome reads the muted ATTRIBUTE when it decides whether a play() is
    // allowed; the property alone lets the promise reject and the tile reset.
    v.setAttribute('muted', '');
    v.preload = 'auto';
    var poster = tile.querySelector('img');
    if (poster) v.setAttribute('aria-label', poster.alt || 'Creator video');
    tile.insertBefore(v, tile.firstChild.nextSibling);
    return v;
  }

  function stop(tile) {
    var v = tile.querySelector('video');
    if (v) { v.pause(); v.currentTime = 0; v.muted = true; }
    tile.classList.remove('is-live', 'is-loud');
    if (playing === tile) playing = null;
  }

  function start(tile) {
    if (playing && playing !== tile) stop(playing);
    var v = build(tile);
    tile.classList.add('is-live');
    playing = tile;
    var p = v.play();
    if (p && typeof p.catch === 'function') p.catch(function () { stop(tile); });
  }

  Array.prototype.forEach.call(tiles, function (tile) {
    var playBtn = tile.querySelector('.cs-creator__play');
    var soundBtn = tile.querySelector('.cs-creator__sound');

    var label = playBtn && playBtn.getAttribute('aria-label');

    if (playBtn) {
      playBtn.addEventListener('click', function () {
        if (tile.classList.contains('is-live')) stop(tile);
        else start(tile);
        // it is one button doing two things, so it has to name the next one
        playBtn.setAttribute('aria-label',
          tile.classList.contains('is-live') ? label.replace('Play', 'Pause') : label);
      });
    }

    if (soundBtn) {
      soundBtn.addEventListener('click', function (e) {
        e.stopPropagation();             // the tile below also toggles playback
        var v = tile.querySelector('video');
        if (!v) return;
        v.muted = !v.muted;
        tile.classList.toggle('is-loud', !v.muted);
        soundBtn.setAttribute('aria-label', v.muted ? 'Unmute' : 'Mute');
      });
    }
  });

  // a video scrolled well out of the rail has stopped being watched
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting && en.target.classList.contains('is-live')) stop(en.target);
      });
    }, { threshold: 0.25 });
    Array.prototype.forEach.call(tiles, function (t) { io.observe(t); });
  }
})();
