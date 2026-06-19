/* ================================================
   Japanese Flashcard Viewer — Single Card Logic
   ================================================ */

(function () {
  'use strict';

  // ── State ──────────────────────────────────
  var deck = null;
  var cards = [];
  var currentIndex = 0;
  var reviewed = {};
  var activeFilter = 'all';
  var activeSort = 'frequency';

  // ── DOM refs ───────────────────────────────
  var $ = function (id) { return document.getElementById(id); };
  var videoTitle  = $('videoTitle');
  var breakdown   = $('breakdown');
  var cardStage   = $('cardStage');
  var flipCard    = $('flipCard');
  var tiltLayer   = $('tiltLayer');
  var cardWord    = $('cardWord');
  var cardHint    = $('cardHint');
  var backReading = $('backReading');
  var backMeaning = $('backMeaning');
  var backPos     = $('backPos');
  var backJlpt    = $('backJlpt');
  var backCount   = $('backCount');
  var backYt      = $('backYt');
  var backSec     = $('backSec');
  var pagination  = $('pagination');
  var prevBtn     = $('prevBtn');
  var nextBtn     = $('nextBtn');
  var progress    = $('progress');
  var emptyState  = $('emptyState');
  var errorState  = $('errorState');
  var errorMsg    = $('errorMsg');
  var sortSelect  = $('sortSelect');

  // ── Tilt state ─────────────────────────────
  var tiltEnabled = true;
  var isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;

  // ── Populate the single card ───────────────
  function populateCard(index) {
    if (!cards.length || index < 0 || index >= cards.length) return;
    var card = cards[index];

    // Reset flip
    flipCard.classList.remove('flipped');
    flipCard.setAttribute('aria-pressed', 'false');

    // Front — Japanese word
    cardWord.textContent = card.front || '';

    // Back
    backReading.textContent = (card.back && card.back.reading) || '—';
    backMeaning.textContent = (card.back && card.back.meaning) || '—';
    backPos.textContent = (card.back && card.back.part_of_speech) || '';

    var lvl = (card.back && card.back.jlpt_level) || 'N/A';
    var lvlLower = lvl.toLowerCase().replace('/', '-');
    backJlpt.textContent = lvl;
    backJlpt.className = 'jlpt-badge ' + lvlLower;

    backCount.textContent = (card.back && card.back.occurrence_count)
      ? '×' + card.back.occurrence_count
      : '';

    // YouTube link
    if (card.youtube_link) {
      backYt.href = card.youtube_link;
      backYt.style.display = 'inline-flex';
    } else {
      backYt.style.display = 'none';
    }

    // Secondary links
    if (card.secondary_links && card.secondary_links.length) {
      var items = card.secondary_links.map(function (url, i) {
        return '<a href="' + url + '" target="_blank" rel="noopener">#' + (i + 2) + '</a>';
      });
      backSec.innerHTML = 'Also at: ' + items.join(', ');
      backSec.style.display = 'block';
    } else {
      backSec.innerHTML = '';
      backSec.style.display = 'none';
    }
  }

  // ── Flip card ──────────────────────────────
  function flip() {
    if (!cards.length) return;

    // Reset tilt before flipping — if flipping to back, disable tilt
    if (!flipCard.classList.contains('flipped')) {
      // Going from front → back: reset tilt first
      resetTilt(true);
    }

    flipCard.classList.toggle('flipped');
    var isFlipped = flipCard.classList.contains('flipped');
    flipCard.setAttribute('aria-pressed', String(isFlipped));

    // Disable tilt when flipped (coordinate space is inverted)
    if (isFlipped) {
      tiltEnabled = false;
      cardHint.style.opacity = '0';
    } else {
      tiltEnabled = true;
      cardHint.style.opacity = '';
      // Re-attach tilt tracking on the new front
      resetTilt(true);
    }

    if (isFlipped) {
      reviewed[cards[currentIndex].id] = true;
      updateProgress();
    }
  }

  // ── 3D Tilt (card-7 pattern) ──────────────
  function onTiltMove(e) {
    if (!tiltEnabled || isTouch) return;

    var rect = flipCard.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;

    // ±8° range (card-7 exact values)
    var rotateY = (x / rect.width - 0.5) * 16;
    var rotateX = (y / rect.height - 0.5) * -16;

    tiltLayer.classList.remove('is-resetting');
    tiltLayer.style.transform =
      'perspective(1200px) ' +
      'rotateX(' + rotateX.toFixed(2) + 'deg) ' +
      'rotateY(' + rotateY.toFixed(2) + 'deg) ' +
      'scale3d(1.04, 1.04, 1.04)';
  }

  function onTiltLeave() {
    resetTilt(true);
  }

  function resetTilt(animate) {
    if (animate) {
      tiltLayer.classList.add('is-resetting');
    } else {
      tiltLayer.classList.remove('is-resetting');
    }
    tiltLayer.style.transform =
      'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  }

  function attachTilt() {
    if (isTouch) return;
    flipCard.addEventListener('mousemove', onTiltMove);
    flipCard.addEventListener('mouseleave', onTiltLeave);
  }

  function detachTilt() {
    flipCard.removeEventListener('mousemove', onTiltMove);
    flipCard.removeEventListener('mouseleave', onTiltLeave);
  }

  // ── Navigate ───────────────────────────────
  function goTo(index) {
    if (index < 0 || index >= cards.length || index === currentIndex) return;
    resetTilt(true);
    currentIndex = index;
    populateCard(currentIndex);
    renderPagination();
    updateProgress();
  }

  function goPrev() {
    if (cards.length <= 1) return;
    var prev = currentIndex - 1;
    if (prev < 0) prev = cards.length - 1;
    goTo(prev);
  }

  function goNext() {
    if (cards.length <= 1) return;
    var next = currentIndex + 1;
    if (next >= cards.length) next = 0;
    goTo(next);
  }

  // ── Pagination dots ────────────────────────
  function renderPagination() {
    pagination.innerHTML = '';
    if (cards.length <= 1) return;

    for (var i = 0; i < cards.length; i++) {
      var dot = document.createElement('span');
      dot.className = 'pagination-dot';
      if (i === currentIndex) {
        dot.classList.add('active');
        var lvl = (cards[i].back && cards[i].back.jlpt_level) || 'N/A';
        dot.classList.add(lvl.toLowerCase().replace('/', '-'));
      }
      dot.title = 'Card ' + (i + 1);
      (function (idx) {
        dot.addEventListener('click', function () { goTo(idx); });
      })(i);
      pagination.appendChild(dot);
    }
  }

  // ── Progress ───────────────────────────────
  function updateProgress() {
    progress.textContent = Object.keys(reviewed).length + ' of ' + cards.length + ' reviewed';
  }

  // ── Meta / Breakdown ───────────────────────
  function renderMeta() {
    if (!deck || !deck.meta) return;
    videoTitle.textContent = deck.meta.video_title || '';
    var jb = deck.meta.jlpt_breakdown || {};
    var parts = [];
    for (var level in jb) {
      if (jb.hasOwnProperty(level)) {
        var cls = 'level-' + level.toLowerCase().replace('/', '-');
        parts.push('<span class="' + cls + '">' + level + ': ' + jb[level] + '</span>');
      }
    }
    breakdown.innerHTML = parts.join('');
  }

  // ── Filter & Sort ──────────────────────────
  function applyFilterAndSort() {
    cards = deck.cards.slice();
  }

  function applySort() {
    if (activeSort === 'jlpt-asc') {
      var order = { 'N5': 0, 'N4': 1, 'N3': 2 };
      cards.sort(function (a, b) {
        return (order[a.jlpt_level] || 9) - (order[b.jlpt_level] || 9);
      });
    } else if (activeSort === 'jlpt-desc') {
      var order = { 'N3': 0, 'N4': 1, 'N5': 2 };
      cards.sort(function (a, b) {
        return (order[a.jlpt_level] || 9) - (order[b.jlpt_level] || 9);
      });
    } else {
      // frequency — keep original order
      if (activeFilter === 'all') {
        cards = deck.cards.slice();
      } else {
        cards = deck.cards.filter(function (c) { return c.jlpt_level === activeFilter; });
      }
    }
  }

  window._flashcardFilter = function (level) {
    activeFilter = level;
    if (!deck) return;
    resetTilt(true);
    cards = level === 'all'
      ? deck.cards.slice()
      : deck.cards.filter(function (c) { return c.jlpt_level === level; });
    applySort();
    currentIndex = 0;
    reviewed = {};
    tiltEnabled = true;
    populateCard(0);
    renderPagination();
    updateProgress();
    showHideEmpty();
  };

  window._flashcardSort = function (mode) {
    activeSort = mode;
    if (!deck) return;
    resetTilt(true);
    if (activeFilter === 'all') {
      cards = deck.cards.slice();
    } else {
      cards = deck.cards.filter(function (c) { return c.jlpt_level === activeFilter; });
    }
    applySort();
    currentIndex = 0;
    tiltEnabled = true;
    populateCard(0);
    renderPagination();
    updateProgress();
  };

  function showHideEmpty() {
    if (cards.length === 0) {
      showEmpty();
    } else {
      hideMessages();
    }
  }

  // ── Filter button wiring ───────────────────
  document.querySelectorAll('.filter-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
      this.classList.add('active');
      window._flashcardFilter(this.dataset.filter);
    });
  });

  sortSelect.addEventListener('change', function () {
    window._flashcardSort(this.value);
  });

  // ── Card click / keyboard ──────────────────
  flipCard.addEventListener('click', flip);

  flipCard.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      flip();
    }
  });

  // ── Arrow buttons ──────────────────────────
  prevBtn.addEventListener('click', goPrev);
  nextBtn.addEventListener('click', goNext);

  // ── Global keyboard ────────────────────────
  document.addEventListener('keydown', function (e) {
    if (!cards.length) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNext();
    } else if (e.key === ' ') {
      e.preventDefault();
      flip();
    }
  });

  // ── States ─────────────────────────────────
  function showEmpty() {
    cardStage.style.display = 'none';
    pagination.style.display = 'none';
    progress.style.display = 'none';
    emptyState.style.display = 'block';
    errorState.style.display = 'none';
  }

  function showError(msg) {
    cardStage.style.display = 'none';
    pagination.style.display = 'none';
    progress.style.display = 'none';
    emptyState.style.display = 'none';
    errorState.style.display = 'block';
    errorMsg.textContent = msg || 'An unexpected error occurred.';
  }

  function hideMessages() {
    cardStage.style.display = '';
    pagination.style.display = '';
    progress.style.display = '';
    emptyState.style.display = 'none';
    errorState.style.display = 'none';
  }

  // ── Load data ──────────────────────────────
  function loadDeck() {
    var dataScript = $('deckData');
    var src = dataScript.getAttribute('src');
    if (src) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', src, true);
      xhr.onload = function () {
        if (xhr.status === 200 || xhr.status === 0) {
          try {
            init(JSON.parse(xhr.responseText));
          } catch (e) {
            showError('Could not parse flashcard data. The JSON file may be malformed.');
          }
        } else {
          showError('Could not load flashcard data. Make sure the JSON file exists.');
        }
      };
      xhr.onerror = function () {
        showError('Could not load flashcard data. Make sure the JSON file exists.');
      };
      xhr.send();
    } else {
      try {
        var data = JSON.parse(dataScript.textContent);
        init(data);
      } catch (e) {
        showError('No flashcard data found. Load a FlashcardDeck JSON file.');
      }
    }
  }

  // ── Init ───────────────────────────────────
  function init(data) {
    deck = data;
    if (!deck.cards || deck.cards.length === 0) {
      showEmpty();
      return;
    }
    hideMessages();
    renderMeta();
    applyFilterAndSort();

    if (cards.length === 0) {
      showEmpty();
      return;
    }

    currentIndex = 0;
    reviewed = {};
    tiltEnabled = true;
    populateCard(0);
    renderPagination();
    updateProgress();
    attachTilt();
  }

  // ── Start ──────────────────────────────────
  loadDeck();

})();
