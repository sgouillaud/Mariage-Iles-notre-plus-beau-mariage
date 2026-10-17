// Intro « notre itinéraire » : sur une carte de voyage ancienne, un petit avion relie nos îles une à une
// (Maurice, La Réunion, Guadeloupe, Martinique, les Saintes, Koh Samui, la Corse) jusqu'à Yron.
// S'ouvre sur un bouton « Embarquer » (pour le son), puis environ 6 secondes ; un toucher la fait passer. Jouée une fois par visite ;
// désactivée si l'appareil demande moins d'animations.
(function () {
  var html = document.documentElement;
  html.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var seen = false;
  try { seen = sessionStorage.getItem('intro') === '1'; sessionStorage.setItem('intro', '1'); } catch (e) { /* stockage indisponible */ }
  var parti = false;
  function go() {
    if (parti) return; parti = true;
    html.classList.add('go');
    document.dispatchEvent(new Event('iles:go'));
  }
  window.ilesGo = function () { return parti; };
  var secours = setTimeout(go, 9000); // filet de sécurité

  if (reduce || seen) { document.addEventListener('DOMContentLoaded', go); return; }

  var NS = 'http://www.w3.org/2000/svg';
  // Contours réels (Natural Earth, domaine public), chaque île mise à une taille lisible
  var FORMES = {"Île Maurice": {"d": "M23.2 -2.6 L23.0 -0.2 L22.5 2.6 L21.5 5.7 L21.3 7.2 L21.8 8.8 L19.5 9.5 L16.9 11.6 L15.3 14.0 L16.0 15.6 L16.1 16.3 L16.6 17.2 L16.7 17.7 L16.4 18.7 L15.8 18.8 L15.2 18.8 L14.7 19.1 L13.4 21.4 L12.7 22.4 L11.5 23.2 L3.7 25.7 L-4.3 27.0 L-7.2 26.8 L-11.6 25.3 L-14.2 25.1 L-16.2 26.0 L-21.6 21.1 L-22.8 19.7 L-23.2 18.3 L-21.7 17.7 L-19.4 18.2 L-18.1 18.0 L-17.5 16.7 L-17.0 13.9 L-17.1 12.8 L-18.1 12.2 L-17.4 9.8 L-17.3 4.3 L-16.9 1.2 L-16.2 -0.5 L-14.1 -4.8 L-13.3 -5.6 L-13.1 -5.9 L-11.0 -7.7 L-10.1 -8.1 L-8.1 -8.7 L-7.2 -9.1 L-5.5 -10.8 L-5.3 -12.7 L-5.2 -14.5 L-3.8 -17.2 L-2.6 -20.8 L-2.0 -21.8 L-1.6 -22.4 L1.0 -24.5 L1.6 -24.8 L2.9 -24.9 L3.4 -25.3 L3.9 -26.0 L4.4 -26.7 L5.4 -27.0 L6.9 -26.8 L11.1 -25.5 L12.3 -24.9 L12.7 -23.8 L12.2 -22.1 L12.6 -21.1 L13.2 -20.2 L14.0 -18.5 L14.8 -17.1 L15.0 -15.9 L15.5 -15.3 L15.9 -15.2 L17.0 -15.4 L17.3 -15.3 L18.4 -14.4 L18.7 -13.7 L18.4 -10.5 L19.1 -9.5 L20.1 -8.7 L21.0 -5.8 L22.8 -3.6 L23.2 -2.6Z", "w": 46, "h": 54}, "La Réunion": {"d": "M20.5 -1.1 L21.6 -0.4 L24.6 0.9 L25.6 1.9 L26.0 3.6 L25.6 5.1 L24.8 6.6 L23.5 13.1 L23.3 15.0 L23.4 16.6 L23.2 18.5 L22.5 20.1 L20.8 20.7 L17.8 20.6 L16.4 20.9 L13.8 22.3 L11.8 22.6 L9.9 22.5 L8.6 21.9 L7.2 22.4 L5.1 22.5 L2.9 22.3 L1.2 21.9 L-0.2 21.2 L-2.8 19.3 L-5.3 18.7 L-8.7 17.3 L-10.1 16.5 L-10.8 15.7 L-11.2 14.9 L-11.8 14.3 L-12.6 14.1 L-15.3 14.0 L-15.7 13.8 L-16.3 12.5 L-19.2 9.2 L-20.2 7.4 L-20.6 5.3 L-20.6 3.8 L-20.8 2.4 L-24.3 -2.2 L-25.4 -4.1 L-26.0 -6.0 L-26.0 -7.7 L-25.5 -9.4 L-24.6 -10.9 L-21.9 -12.0 L-20.8 -13.4 L-20.5 -15.0 L-20.9 -16.3 L-20.4 -16.8 L-20.2 -17.2 L-20.4 -17.6 L-20.9 -18.1 L-19.6 -18.7 L-16.9 -18.7 L-14.5 -20.4 L-10.9 -22.4 L-7.0 -22.6 L-5.6 -22.4 L-3.2 -21.5 L-2.1 -21.3 L-1.1 -21.8 L0.2 -21.4 L3.2 -21.4 L4.3 -20.9 L5.4 -20.2 L9.1 -19.3 L10.2 -18.7 L11.1 -18.0 L12.8 -16.0 L13.5 -14.8 L13.8 -11.9 L14.2 -10.9 L16.3 -8.7 L16.5 -8.1 L16.7 -6.3 L16.8 -5.4 L17.1 -4.7 L17.6 -4.4 L19.1 -3.7 L19.4 -3.3 L19.5 -2.9 L20.5 -1.1Z", "w": 52, "h": 45}, "Guadeloupe": {"d": "M-6.4 -5.7 L-6.4 -5.7 L-6.4 -5.7 L-4.7 -11.2 L-3.8 -12.4 L-1.9 -12.8 L-1.7 -13.2 L-1.5 -14.1 L-1.5 -15.1 L-1.6 -15.8 L-2.0 -16.2 L-2.7 -16.7 L-3.5 -17.0 L-4.3 -17.2 L-4.9 -21.0 L-5.4 -21.9 L-5.4 -22.9 L-4.5 -24.3 L-2.9 -26.2 L-2.5 -26.9 L-1.6 -27.6 L1.6 -29.3 L1.8 -29.6 L2.2 -29.5 L5.4 -27.1 L7.2 -25.4 L8.4 -23.2 L8.8 -20.4 L8.6 -17.7 L8.7 -16.6 L9.5 -15.0 L10.5 -13.5 L11.6 -12.4 L12.9 -11.5 L14.3 -10.7 L15.0 -11.5 L16.1 -10.9 L17.0 -10.8 L18.1 -10.9 L19.2 -10.7 L20.2 -10.1 L22.4 -8.2 L23.0 -7.8 L24.0 -7.3 L29.5 -3.4 L31.4 -2.9 L32.0 -2.3 L30.9 -1.3 L30.0 -1.4 L27.2 -2.1 L26.4 -2.4 L24.8 -2.9 L7.1 1.2 L3.7 2.7 L1.9 3.0 L-0.3 2.7 L-2.3 1.9 L-4.0 0.9 L-5.4 -0.2 L-6.4 -1.5 L-6.8 -2.8 L-6.8 -4.2 L-6.4 -5.7Z M-7.2 -5.7 L-6.9 -5.2 L-7.5 -2.9 L-6.8 -0.8 L-7.5 -0.6 L-9.3 -0.2 L-10.0 0.9 L-9.7 5.8 L-8.5 9.5 L-7.8 15.2 L-8.6 20.8 L-11.8 24.6 L-16.4 27.4 L-21.6 29.6 L-21.8 29.0 L-22.4 27.5 L-21.6 26.8 L-22.3 25.4 L-23.2 24.6 L-24.3 23.9 L-25.4 22.8 L-26.2 21.6 L-26.5 20.4 L-26.9 19.4 L-27.8 18.8 L-29.1 15.1 L-29.1 6.8 L-30.6 3.0 L-30.1 1.5 L-30.6 0.2 L-31.4 -0.9 L-32.0 -2.1 L-32.0 -3.9 L-31.6 -7.1 L-32.0 -8.5 L-31.0 -9.4 L-29.3 -12.4 L-27.8 -13.6 L-25.9 -14.1 L-25.0 -13.5 L-24.4 -12.6 L-23.3 -12.1 L-20.8 -11.6 L-17.1 -10.3 L-13.6 -8.5 L-11.9 -6.4 L-13.3 -5.7 L-12.5 -5.4 L-12.4 -5.3 L-12.3 -5.4 L-11.9 -5.7 L-11.6 -5.3 L-10.5 -4.2 L-10.0 -5.4 L-9.1 -6.2 L-7.8 -6.4 L-7.2 -5.7Z", "w": 64, "h": 59}, "Martinique": {"d": "M21.6 19.3 L20.3 19.8 L19.1 22.9 L18.0 24.4 L16.8 24.9 L15.4 25.0 L14.2 24.4 L13.7 22.9 L14.3 21.8 L15.5 21.4 L16.5 20.9 L16.6 19.3 L15.6 17.8 L14.2 18.3 L12.5 19.4 L10.9 19.3 L11.0 18.2 L10.3 18.0 L7.4 18.5 L1.4 17.7 L-0.2 18.0 L-2.8 19.0 L-4.3 19.3 L-5.2 18.8 L-7.4 15.5 L-7.4 14.7 L-7.5 14.3 L-8.0 14.0 L-8.9 13.4 L-6.1 10.4 L-3.4 9.1 L-2.5 8.3 L-1.4 9.9 L0.2 10.4 L1.7 9.8 L2.4 8.3 L2.1 7.6 L1.3 6.5 L0.5 5.0 L0.3 3.2 L-1.2 3.7 L-2.5 4.0 L-3.6 4.0 L-4.7 3.9 L-6.8 4.0 L-7.4 3.9 L-7.9 3.4 L-8.5 2.2 L-8.9 1.7 L-12.6 -0.8 L-14.4 -2.6 L-15.2 -4.5 L-15.3 -5.2 L-15.5 -5.8 L-15.9 -6.3 L-16.3 -6.8 L-16.7 -7.5 L-16.6 -8.2 L-16.2 -8.9 L-16.0 -9.6 L-16.3 -10.9 L-16.9 -12.1 L-17.6 -13.2 L-20.6 -16.3 L-21.3 -17.6 L-21.6 -19.1 L-21.3 -20.6 L-20.6 -21.8 L-19.7 -22.6 L-15.6 -24.9 L-12.0 -25.0 L-8.5 -23.9 L-3.9 -20.9 L0.1 -19.1 L1.8 -18.0 L2.2 -17.2 L2.5 -16.3 L3.0 -15.5 L4.2 -15.2 L6.0 -11.5 L7.5 -12.7 L9.6 -13.7 L12.0 -14.4 L14.5 -14.4 L13.8 -13.8 L13.1 -13.4 L12.8 -12.9 L13.1 -12.3 L10.9 -10.0 L9.6 -12.1 L8.9 -11.5 L8.6 -9.5 L8.8 -7.1 L9.6 -7.5 L10.4 -7.4 L11.0 -7.0 L11.6 -6.4 L8.8 -4.9 L9.5 -4.1 L8.3 -3.5 L8.5 -2.5 L9.4 -2.2 L10.3 -3.5 L13.7 -1.9 L12.9 -1.8 L12.5 -1.7 L12.2 -1.4 L11.6 -1.2 L12.2 0.4 L13.0 1.2 L15.1 2.4 L15.4 3.0 L15.6 3.7 L16.0 4.4 L16.9 4.6 L17.7 4.9 L18.0 5.7 L18.1 6.7 L18.0 7.6 L19.3 6.8 L19.0 8.2 L18.9 9.5 L19.3 10.8 L20.1 12.0 L19.5 12.3 L19.2 12.6 L19.0 12.9 L18.7 13.4 L20.1 14.1 L20.6 15.6 L20.9 17.2 L21.6 18.5 L21.6 19.3Z", "w": 43, "h": 50}, "Les Saintes": {"d": "M-8.2 -2.2 L-6.9 -0.9 L-5.1 1.9 L-6.1 4.8 L-9.2 6.7 L-13.0 4.4 L-11.7 -0.4 L-8.2 -2.2Z M12.5 -4.9 L12.6 -4.3 L13.0 -3.4 L11.0 -1.6 L6.9 1.2 L3.2 2.5 L2.1 0.9 L4.0 -0.9 L5.9 -2.0 L7.7 -5.8 L9.9 -6.7 L11.9 -5.9 L12.5 -4.9Z", "w": 26, "h": 13}, "Koh Samui": {"d": "M15.9 -22.0 L17.4 -21.6 L20.0 -18.9 L21.2 -15.3 L18.5 -12.5 L16.3 -5.1 L15.5 3.3 L13.5 10.1 L6.1 13.6 L5.5 15.4 L5.2 17.4 L4.5 19.1 L2.8 20.0 L0.8 20.1 L-1.3 19.9 L-13.5 21.1 L-16.0 22.0 L-17.5 17.0 L-18.5 7.3 L-21.2 2.2 L-17.4 -2.5 L-17.8 -7.3 L-19.9 -12.1 L-21.2 -16.7 L-18.6 -19.7 L-12.6 -20.5 L-6.1 -20.1 L9.1 -16.2 L13.9 -17.0 L15.9 -22.0Z", "w": 42, "h": 44}, "Corse": {"d": "M-13.1 -0.6 L-12.9 -1.0 L-13.1 -1.2 L-13.5 -1.4 L-13.7 -1.5 L-13.6 -1.8 L-13.3 -1.9 L-12.6 -1.9 L-12.4 -2.0 L-12.2 -2.1 L-11.9 -2.3 L-10.8 -2.5 L-10.5 -2.7 L-10.2 -2.9 L-10.0 -2.9 L-9.9 -2.9 L-9.8 -3.0 L-9.8 -3.2 L-10.2 -3.6 L-10.3 -3.6 L-11.3 -4.1 L-11.3 -4.3 L-11.4 -4.5 L-11.5 -4.6 L-11.9 -4.3 L-12.1 -4.3 L-12.2 -4.5 L-12.2 -4.7 L-12.1 -4.9 L-11.3 -5.4 L-11.9 -5.8 L-12.4 -5.8 L-13.5 -5.4 L-13.3 -5.6 L-13.5 -5.9 L-13.6 -6.3 L-13.6 -6.7 L-13.5 -7.1 L-13.3 -6.9 L-13.0 -6.9 L-12.7 -7.1 L-12.6 -7.3 L-12.2 -7.1 L-12.1 -7.3 L-12.1 -7.6 L-12.0 -7.8 L-11.9 -8.0 L-11.8 -8.2 L-11.7 -8.3 L-10.8 -8.4 L-10.6 -8.7 L-10.5 -9.0 L-10.5 -9.5 L-10.2 -9.9 L-10.1 -10.2 L-10.3 -10.3 L-10.6 -10.4 L-10.7 -10.5 L-10.6 -10.6 L-10.4 -11.6 L-10.0 -12.0 L-9.6 -12.2 L-9.1 -12.3 L-9.2 -12.7 L-9.1 -13.5 L-9.3 -13.8 L-9.3 -14.1 L-9.0 -14.0 L-9.0 -14.0 L-8.9 -13.9 L-8.9 -13.6 L-8.4 -13.8 L-8.1 -13.7 L-7.9 -13.4 L-7.6 -13.3 L-7.2 -13.5 L-6.8 -13.8 L-6.6 -14.3 L-6.5 -14.8 L-6.7 -15.1 L-5.6 -15.1 L-3.9 -16.0 L-0.9 -16.7 L-0.1 -17.1 L0.0 -17.8 L1.5 -19.4 L1.8 -19.6 L2.4 -19.7 L3.0 -19.7 L3.3 -19.7 L3.6 -19.7 L5.0 -19.3 L5.5 -19.0 L5.7 -18.8 L5.9 -18.5 L6.0 -18.3 L6.3 -17.6 L6.5 -17.6 L7.4 -19.2 L7.8 -20.3 L7.6 -21.0 L7.8 -21.7 L7.6 -22.4 L7.3 -23.0 L6.8 -23.5 L7.6 -24.5 L7.6 -24.9 L7.4 -25.2 L7.4 -25.5 L7.5 -25.9 L7.7 -26.1 L8.3 -26.8 L8.2 -27.0 L8.2 -27.1 L8.2 -27.2 L8.3 -27.5 L8.0 -27.8 L7.8 -28.4 L7.8 -29.0 L7.9 -29.5 L8.4 -29.8 L9.5 -29.8 L10.0 -30.0 L10.3 -29.5 L10.6 -29.3 L11.1 -29.0 L11.1 -28.7 L10.9 -28.4 L10.8 -28.1 L11.0 -27.6 L11.3 -27.3 L11.1 -26.6 L11.6 -23.3 L11.6 -22.2 L10.7 -18.8 L10.8 -18.3 L10.7 -17.8 L10.7 -16.8 L10.7 -16.7 L10.6 -16.6 L10.5 -16.5 L10.5 -16.3 L10.6 -16.2 L10.7 -16.1 L10.8 -16.1 L10.9 -16.1 L11.0 -15.8 L11.0 -15.6 L11.0 -15.4 L10.9 -15.1 L11.1 -14.9 L11.2 -14.7 L11.3 -14.4 L11.4 -14.1 L11.7 -13.9 L12.4 -13.6 L12.3 -14.1 L12.2 -14.3 L11.8 -15.3 L12.6 -14.1 L12.8 -13.5 L12.9 -12.8 L12.9 -10.7 L13.0 -9.6 L13.3 -8.8 L13.1 -8.4 L13.0 -7.9 L12.9 -7.3 L12.9 -6.6 L13.1 -5.9 L13.6 -4.5 L13.7 -3.7 L13.5 0.8 L13.7 1.6 L13.6 1.9 L13.5 2.6 L13.5 2.9 L13.3 3.2 L12.6 3.9 L12.3 4.3 L11.9 5.2 L10.0 7.9 L9.6 8.3 L9.5 8.7 L9.4 10.0 L9.2 12.5 L9.5 15.0 L9.4 17.6 L9.3 17.8 L9.1 17.9 L8.9 18.1 L8.6 18.4 L8.5 18.8 L8.9 18.8 L8.8 19.4 L8.6 19.9 L8.4 20.0 L8.1 20.0 L7.9 20.0 L7.8 20.2 L7.9 20.8 L7.6 20.6 L7.2 20.5 L6.8 20.5 L6.5 20.5 L6.5 20.9 L6.3 21.2 L6.1 21.6 L6.5 21.8 L7.3 21.4 L7.9 21.3 L8.1 21.7 L8.0 22.2 L7.8 22.6 L7.4 22.9 L6.9 23.0 L6.7 23.2 L6.5 23.6 L6.2 23.9 L5.7 24.0 L5.8 24.3 L5.9 24.5 L5.8 24.8 L5.7 25.0 L6.0 25.1 L6.1 25.4 L6.0 25.8 L5.7 26.0 L5.9 26.3 L5.5 26.5 L4.7 26.9 L4.3 27.0 L4.3 27.3 L4.5 27.5 L4.6 27.8 L4.5 28.0 L4.3 28.3 L4.3 28.5 L4.6 28.4 L5.0 28.0 L5.3 27.8 L5.2 28.3 L5.0 28.9 L4.8 29.5 L4.6 29.8 L4.2 30.0 L3.8 29.9 L3.1 29.3 L2.7 29.1 L1.9 28.9 L1.2 28.6 L1.5 27.7 L1.6 27.6 L1.9 27.5 L1.4 27.1 L0.8 26.8 L0.4 26.5 L0.7 26.0 L0.7 25.8 L0.4 25.9 L-0.4 26.5 L-0.6 26.3 L-0.5 26.2 L-0.5 26.2 L-0.4 26.1 L-0.4 26.0 L-0.7 26.1 L-0.8 26.1 L-0.9 26.3 L-1.1 26.0 L-1.4 25.7 L-2.1 25.5 L-2.7 25.4 L-3.1 25.5 L-3.4 25.3 L-3.7 25.1 L-3.9 24.9 L-4.6 24.7 L-4.6 24.6 L-4.7 24.4 L-4.8 24.3 L-5.1 24.2 L-5.3 24.2 L-5.5 24.2 L-5.7 24.0 L-5.4 23.8 L-5.4 23.5 L-5.7 23.4 L-5.9 23.3 L-6.2 23.3 L-6.5 23.2 L-6.9 23.1 L-7.0 22.9 L-6.9 22.2 L-7.0 22.0 L-7.4 21.8 L-7.2 21.3 L-7.0 20.6 L-6.8 20.1 L-6.3 20.3 L-4.8 19.6 L-4.6 19.4 L-4.5 18.9 L-4.2 18.7 L-3.8 18.4 L-3.5 18.1 L-4.1 18.0 L-5.8 17.5 L-6.5 17.5 L-7.1 17.4 L-7.4 17.0 L-7.2 16.3 L-7.9 16.3 L-9.0 16.7 L-9.6 16.8 L-9.6 16.7 L-9.4 16.3 L-9.8 16.3 L-10.1 16.3 L-10.4 16.1 L-10.7 16.0 L-10.4 15.9 L-9.6 15.7 L-9.3 15.6 L-9.0 15.2 L-8.9 14.9 L-9.0 14.5 L-9.3 14.3 L-9.3 14.1 L-8.6 14.1 L-8.1 13.9 L-7.2 13.3 L-7.3 13.0 L-7.6 12.8 L-7.8 12.6 L-8.1 12.6 L-7.2 12.3 L-7.0 12.1 L-7.1 12.0 L-7.2 11.8 L-7.3 11.6 L-7.4 11.6 L-7.1 11.1 L-7.0 11.1 L-7.0 10.9 L-6.7 10.6 L-6.7 10.3 L-6.7 10.3 L-7.0 10.1 L-7.2 9.8 L-7.3 9.6 L-7.5 9.4 L-7.8 9.4 L-8.3 9.4 L-9.2 9.9 L-9.8 10.1 L-10.9 10.2 L-11.4 10.3 L-11.8 10.6 L-12.0 10.1 L-11.7 9.5 L-11.8 9.0 L-12.6 8.1 L-11.2 8.0 L-10.7 7.7 L-10.3 7.1 L-10.7 6.9 L-10.5 6.4 L-9.9 6.0 L-9.3 5.9 L-9.2 5.8 L-8.5 5.4 L-8.3 5.4 L-8.3 4.9 L-8.4 4.7 L-8.9 4.3 L-9.3 3.3 L-9.5 3.0 L-9.8 2.9 L-10.6 3.1 L-10.7 3.0 L-10.9 2.5 L-11.4 2.2 L-12.0 2.1 L-12.6 2.1 L-12.4 1.8 L-12.4 1.6 L-12.6 1.5 L-12.8 1.4 L-13.0 1.3 L-13.3 1.4 L-13.0 1.3 L-12.8 1.2 L-12.4 0.9 L-12.4 0.6 L-13.1 0.6 L-13.1 0.4 L-12.8 0.2 L-12.7 -0.1 L-12.8 -0.5 L-13.1 -0.6Z", "w": 27, "h": 60}};
  var ILES = [
    { nom: 'Île Maurice', x: 262, y: 590 },
    { nom: 'La Réunion', x: 100, y: 548 },
    { nom: 'Guadeloupe', x: 258, y: 462 },
    { nom: 'Martinique', x: 92, y: 392 },
    { nom: 'Les Saintes', x: 246, y: 322 },
    { nom: 'Koh Samui', x: 98, y: 248 },
    { nom: 'Corse', x: 250, y: 176 },
  ];
  var YRON = { x: 180, y: 86 };

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  // Courbe douce passant par tous les points (Catmull-Rom)
  function route(pts) {
    var d = 'M' + pts[0].x + ' ' + pts[0].y;
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C' + (p1.x + (p2.x - p0.x) / 5) + ' ' + (p1.y + (p2.y - p0.y) / 5) + ',' +
        (p2.x - (p3.x - p1.x) / 5) + ' ' + (p2.y - (p3.y - p1.y) / 5) + ',' + p2.x + ' ' + p2.y;
    }
    return d;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var box = document.createElement('div');
    box.className = 'ouverture';
    box.setAttribute('aria-hidden', 'true');
    document.body.appendChild(box);
    var svg = el('svg', { viewBox: '0 0 360 680', preserveAspectRatio: 'xMidYMid meet' }, box);

    // Mer : petites vaguelettes gravées, rose des vents
    var mer = el('g', { class: 'i-mer' }, svg);
    for (var v = 0; v < 26; v++) {
      var vx = (v * 97) % 330 + 15, vy = (v * 151) % 640 + 25;
      el('path', { d: 'M' + vx + ' ' + vy + ' q4 -4 8 0 t8 0', class: 'i-vaguelette' }, mer);
    }
    var rose = el('g', { class: 'i-rose', transform: 'translate(52 92)' }, svg);
    el('circle', { r: 20 }, rose);
    el('path', { d: 'M0 -28 L4 0 L0 28 L-4 0 Z M-28 0 L0 -4 L28 0 L0 4 Z' }, rose);
    var nord = el('text', { y: -32, 'text-anchor': 'middle' }, rose); nord.textContent = 'N';

    // Les îles
    var groupes = ILES.map(function (p, i) {
      var g = el('g', { class: 'i-ile' }, svg);
      var forme = FORMES[p.nom];
      el('path', { d: forme.d, transform: 'translate(' + p.x + ' ' + p.y + ')', class: 'i-terre' }, g);
      var gauche = p.x > 180;
      var t = el('text', {
        x: gauche ? p.x - forme.w / 2 - 12 : p.x + forme.w / 2 + 12, y: p.y + 4,
        'text-anchor': gauche ? 'end' : 'start', class: 'i-nom',
      }, g);
      t.textContent = p.nom;
      return g;
    });

    // L'itinéraire : pointillés révélés par un masque
    var pts = ILES.map(function (p) { return { x: p.x, y: p.y }; }).concat([YRON]);
    var d = route(pts);
    var defs = el('defs', {}, svg);
    var mask = el('mask', { id: 'i-masque', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 360, height: 680 }, defs);
    var revele = el('path', { d: d, class: 'i-revele' }, mask);
    el('path', { d: d, class: 'i-route', mask: 'url(#i-masque)' }, svg);
    var L = revele.getTotalLength();
    revele.style.strokeDasharray = L;
    revele.style.strokeDashoffset = L;

    // Position de chaque île le long de l'itinéraire
    var seuils = ILES.map(function (p) {
      var best = 0, dmin = 1e9;
      for (var s = 0; s <= 400; s++) {
        var q = revele.getPointAtLength((s / 400) * L);
        var dd = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y);
        if (dd < dmin) { dmin = dd; best = s / 400; }
      }
      return best;
    });

    // Yron : épingle en forme de cœur
    var arrivee = el('g', { class: 'i-arrivee' }, svg);
    el('path', { d: 'M' + YRON.x + ' ' + (YRON.y + 9) + ' c-14 -10 -16 -22 -8 -26 c5 -2 8 1 8 4 c0 -3 3 -6 8 -4 c8 4 6 16 -8 26 z', class: 'i-coeur' }, arrivee);
    var ty = el('text', { x: YRON.x, y: YRON.y + 32, 'text-anchor': 'middle', class: 'i-yron' }, arrivee); ty.textContent = 'Cloyes-les-Trois-Rivières';
    var td = el('text', { x: YRON.x, y: YRON.y + 48, 'text-anchor': 'middle', class: 'i-date' }, arrivee); td.textContent = '26 · 06 · 2027';

    // L'avion
    var avion = el('g', { class: 'i-avion' }, svg);
    el('path', { d: 'M12 0 L-6 -3 L-10 -12 L-13 -12 L-11 -3 L-16 -2 L-19 -6 L-21 -6 L-20 0 L-21 6 L-19 6 L-16 2 L-11 3 L-13 12 L-10 12 L-6 3 Z' }, avion);

    // Légende du bas
    var leg = document.createElement('div');
    leg.className = 'i-legende';
    leg.innerHTML = '<span class="i-eyebrow">Notre itinéraire</span><span class="i-titre">Il.e.s</span><span class="i-sous">Notre plus beau voyage</span>';
    box.appendChild(leg);
    var passer = document.createElement('div');
    passer.className = 'i-passer'; passer.textContent = 'Touchez pour passer';
    box.appendChild(passer);

    // Porte d'embarquement : le son ne peut démarrer qu'après un geste de l'invité
    clearTimeout(secours);
    var porte = document.createElement('div');
    porte.className = 'i-porte';
    porte.innerHTML = '<span class="i-eyebrow">Vol IL 2627 · 26.06.2027</span>' +
      '<button type="button" class="i-embarquer">Embarquer <span aria-hidden="true">✈</span></button>' +
      '<span class="i-son">🔊 Montez le son</span>';
    box.appendChild(porte);

    // Vol plus court (3,5 s) puis 2,5 s pour lire l'arrivée
    var T_VOL0 = 0.3, T_VOL1 = 3.8, T_FIN = 6.3;
    var t0 = null, decalage = 0, fini = false, lance = false, son = null;
    var easeInOut = function (k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; };
    var clamp = function (k) { return Math.max(0, Math.min(1, k)); };

    // Bruit de gros avion de ligne, synthétisé (aucun fichier) : souffle des réacteurs qui
    // approche, passe de gauche à droite puis s'éloigne
    function bruitAvion(duree) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        var ac = new AC();
        var n = ac.sampleRate * (duree + 1), buf = ac.createBuffer(2, n, ac.sampleRate);
        for (var c = 0; c < 2; c++) {
          var d = buf.getChannelData(c), last = 0;
          for (var i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
        }
        var src = ac.createBufferSource(); src.buffer = buf;
        var bp = ac.createBiquadFilter(); bp.type = 'lowpass'; bp.Q.value = 0.8;
        var hum = ac.createOscillator(); hum.type = 'sawtooth';
        var humF = ac.createBiquadFilter(); humF.type = 'lowpass'; humF.frequency.value = 220;
        var humG = ac.createGain(); humG.gain.value = 0.05;
        var g = ac.createGain();
        var pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
        var t = ac.currentTime, mid = t + duree * 0.55, fin = t + duree;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.9, mid);
        g.gain.exponentialRampToValueAtTime(0.0001, fin);
        bp.frequency.setValueAtTime(350, t);
        bp.frequency.exponentialRampToValueAtTime(1400, mid);   // l'avion se rapproche
        bp.frequency.exponentialRampToValueAtTime(260, fin);    // puis s'éloigne (effet Doppler)
        hum.frequency.setValueAtTime(95, t);
        hum.frequency.exponentialRampToValueAtTime(110, mid);
        hum.frequency.exponentialRampToValueAtTime(70, fin);
        if (pan) { pan.pan.setValueAtTime(-0.8, t); pan.pan.linearRampToValueAtTime(0.8, fin); }
        src.connect(bp); bp.connect(g);
        hum.connect(humF); humF.connect(humG); humG.connect(g);
        if (pan) { g.connect(pan); pan.connect(ac.destination); } else g.connect(ac.destination);
        src.start(t); hum.start(t); src.stop(fin + 0.1); hum.stop(fin + 0.1);
        return { stop: function () { try { g.gain.cancelScheduledValues(ac.currentTime); g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.15); setTimeout(function () { ac.close(); }, 600); } catch (e) { /* ignore */ } } };
      } catch (e) { return null; }
    }

    function lancer() {
      if (lance) return; lance = true;
      porte.classList.add('cachee');
      son = bruitAvion(T_VOL1 + 1.2);
      secours = setTimeout(go, 12000);
      requestAnimationFrame(frame);
    }
    porte.querySelector('.i-embarquer').addEventListener('click', function (e) { e.stopPropagation(); lancer(); });

    box.addEventListener('pointerdown', function () {
      if (!lance) { lancer(); return; }
      if (t0 === null) return;
      var t = (performance.now() - t0) / 1000 + decalage;
      if (t < T_FIN) { decalage += T_FIN - t; if (son) son.stop(); }
    });

    function frame(now) {
      if (t0 === null) { t0 = now; box.classList.add('on'); }
      var t = (now - t0) / 1000 + decalage;
      var p = easeInOut(clamp((t - T_VOL0) / (T_VOL1 - T_VOL0)));
      revele.style.strokeDashoffset = L * (1 - p);

      var a = revele.getPointAtLength(Math.max(0, p * L - 0.5));
      var b = revele.getPointAtLength(Math.min(L, p * L + 0.5));
      var ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
      avion.setAttribute('transform', 'translate(' + b.x + ' ' + b.y + ') rotate(' + ang + ')');
      avion.style.opacity = t < T_VOL0 - 0.3 ? 0 : (p >= 1 ? Math.max(0, 1 - (t - T_VOL1) * 3) : 1);

      groupes.forEach(function (g, i) { if (p >= seuils[i] - 0.01) g.classList.add('vue'); });
      if (p >= 0.999) { arrivee.classList.add('vue'); leg.classList.add('vue'); }

      if (t >= T_FIN && !fini) {
        fini = true;
        box.classList.add('part');
        clearTimeout(secours);
        go();
        setTimeout(function () { box.remove(); }, 900);
        return;
      }
      requestAnimationFrame(frame);
    }
  });
})();
