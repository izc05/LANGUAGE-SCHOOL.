(() => {
  const currentScript = document.currentScript;
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const nav = document.querySelector('nav');

  function addNavLink(href, label, beforeNode) {
    if (!nav || nav.querySelector(`a[href="${href}"]`)) return;
    const link = document.createElement('a');
    link.href = href;
    link.dataset.page = href;
    link.textContent = label;
    nav.insertBefore(link, beforeNode || null);
  }

  if (nav) {
    const contact = nav.querySelector('a[href="contacto.html"]');
    const primaryButton = nav.querySelector('.btn.primary');
    addNavLink('blog.html', 'Blog', contact);
    addNavLink('acceso.html', 'Área alumnos', primaryButton);
  }

  if (currentPage === 'index.html') {
    const heroActions = document.querySelector('.hero .ctaRow');
    if (heroActions && !heroActions.querySelector('a[href="acceso.html"]')) {
      const access = document.createElement('a');
      access.className = 'btn';
      access.href = 'acceso.html';
      access.innerHTML = '<span>Acceso alumnos</span>';
      heroActions.appendChild(access);
    }
  }

  const legacy = document.createElement('script');
  legacy.src = new URL('../app.js', currentScript.src).href;
  legacy.defer = true;
  document.body.appendChild(legacy);
})();
