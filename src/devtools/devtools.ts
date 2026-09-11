chrome.devtools.panels.create(
  'StateHunter',
  '',
  'panel.html',
  () => {
    console.debug('[StateHunter] DevTools Panel registered');
  }
);
