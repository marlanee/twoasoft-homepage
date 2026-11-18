(function () {
  'use strict';

  var header = document.querySelector('.site-header');
  var nav = document.getElementById('site-nav');
  var toggle = document.querySelector('.nav-toggle');

  /* 헤더: 스크롤하면 경계선 표시 */
  function onScroll() {
    header.classList.toggle('is-stuck', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* 모바일 메뉴 */
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.visually-hidden').textContent = open ? '메뉴 닫기' : '메뉴 열기';
  }
  toggle.addEventListener('click', function () {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      toggle.focus();
    }
  });

  /* 게시판 탭 */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));

  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab, false); });
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) {
        e.preventDefault();
        selectTab(next, true);
      }
    });
  });

  /* 오시는길: 본사/지사 지도 전환 */
  var mapFrame = document.getElementById('map-frame');
  var mapBtns = Array.prototype.slice.call(document.querySelectorAll('.map-btn'));
  mapBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.getAttribute('aria-pressed') === 'true') return;
      mapBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      mapFrame.src = btn.getAttribute('data-map-src');
      mapFrame.title = btn.getAttribute('data-map-title');
    });
  });

  /* 메뉴의 Data / Notice 는 해당 탭을 연 채로 게시판 섹션으로 이동 */
  var tabLinks = Array.prototype.slice.call(document.querySelectorAll('a[data-tab]'));
  tabLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      var tab = document.getElementById(link.getAttribute('data-tab'));
      if (tab) selectTab(tab, false);
      syncBoardNav();
    });
  });

  /* 현재 보고 있는 섹션을 메뉴에 표시 */
  var spyLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-main a'));
  var currentSection = null;

  function syncBoardNav() {
    var noticeOpen = document.getElementById('tab-notice').getAttribute('aria-selected') === 'true';
    spyLinks.forEach(function (link) {
      var on;
      if (link.hasAttribute('data-tab')) {
        var isNoticeLink = link.getAttribute('data-tab') === 'tab-notice';
        on = currentSection === 'board' && isNoticeLink === noticeOpen;
      } else {
        on = (link.getAttribute('data-spy') || '').split(' ').indexOf(currentSection) !== -1;
      }
      link.classList.toggle('is-current', on);
    });
  }
  tabs.forEach(function (tab) { tab.addEventListener('click', syncBoardNav); });

  if ('IntersectionObserver' in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          currentSection = entry.target.id;
          syncBoardNav();
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    document.querySelectorAll('main section[id]').forEach(function (s) { spy.observe(s); });

    var heroSpy = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        currentSection = null;
        syncBoardNav();
      }
    }, { rootMargin: '-45% 0px -50% 0px' });
    heroSpy.observe(document.querySelector('.hero'));

    /* 섹션 등장 */
    var targets = document.querySelectorAll('.section-head, .greeting-body, .areas, .facts, .map, .tabs, .panel');
    var reveal = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          reveal.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });

    targets.forEach(function (el) {
      el.classList.add('reveal');
      reveal.observe(el);
    });
  }
})();
