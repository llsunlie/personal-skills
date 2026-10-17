(() => {
  const cards = [...document.querySelectorAll('.skill-card')];
  const search = document.querySelector('#skill-search');
  const filters = [...document.querySelectorAll('[data-filter]')];
  const empty = document.querySelector('#empty-state');
  const status = document.querySelector('#filter-status');
  let category = 'all';
  function filterSkills() {
    const words = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    for (const card of cards) {
      const content = (card.dataset.search + ' ' + card.textContent).toLocaleLowerCase();
      const matches = (category === 'all' || card.dataset.category === category) && words.every(word => content.includes(word));
      card.hidden = !matches;
      if (matches) visible++;
    }
    empty.hidden = visible !== 0;
    status.textContent = `显示 ${visible} 个 skill，共 ${cards.length} 个`;
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === category)));
  }
  search.addEventListener('input', filterSkills);
  filters.forEach(button => button.addEventListener('click', () => { category = button.dataset.filter; filterSkills(); }));
  document.querySelector('#reset-search').addEventListener('click', () => { search.value = ''; category = 'all'; filterSkills(); search.focus(); });

  const scope = document.querySelector('#install-scope');
  const command = document.querySelector('#install-command');
  const base = 'git clone https://github.com/llsunlie/personal-skills.git\ncd personal-skills\npython3 scripts/install.py';
  function setCommand() {
    command.textContent = base + (scope.value === 'all' ? '' : ' --skill ' + scope.value);
  }
  scope.addEventListener('change', setCommand);
  document.querySelectorAll('[data-install]').forEach(link => link.addEventListener('click', () => { scope.value = link.dataset.install; setCommand(); }));
  const toast = document.querySelector('#toast');
  let toastTimer;
  function notify(message) {
    toast.textContent = message; toast.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
  }
  document.querySelector('#copy-command').addEventListener('click', async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(command.textContent);
      else {
        const field = document.createElement('textarea');
        field.value = command.textContent;
        field.style.cssText = 'position:fixed;top:-10000px';
        document.body.append(field); field.select();
        let copied;
        try { copied = document.execCommand('copy'); } finally { field.remove(); }
        if (!copied) throw new Error('Clipboard unavailable');
      }
      notify('安装命令已复制');
    } catch { notify('未能访问剪贴板，请选中命令后手动复制'); }
  });
  const dialog = document.querySelector('#source-dialog');
  const content = document.querySelector('#dialog-content');
  document.querySelectorAll('[data-source]').forEach(button => button.addEventListener('click', () => {
    const template = document.querySelector('#source-' + button.dataset.source);
    content.replaceChildren(template.content.cloneNode(true));
    dialog.showModal();
  }));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
})();
