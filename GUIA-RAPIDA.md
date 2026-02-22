# 🎨 GUÍA RÁPIDA DE CUSTOMIZACIÓN

## 🚀 Cambios Rápidos que Puedes Hacer

### 1. Cambiar Colores (5 minutos)

Abre `assets/style.css` y busca las líneas 8-18:

```css
:root {
  --vintage-cream: #F5E6D3;    /* ← Fondo principal */
  --vintage-paper: #E8DCC4;    /* ← Fondo de tarjetas */
  --vintage-gold: #D4AF37;     /* ← Color dorado (botones, acentos) */
  --vintage-copper: #B87333;   /* ← Color cobre (degradados) */
  --vintage-brown: #8B6F47;    /* ← Marrón (textos, bordes) */
  --vintage-dark: #3E2723;     /* ← Oscuro (textos principales) */
}
```

**Paletas Alternativas Sugeridas:**

**Opción 1 - Azul Vintage:**
```css
--vintage-cream: #E8EFF5;
--vintage-gold: #4A90C1;
--vintage-copper: #2C5F87;
```

**Opción 2 - Verde Oliva:**
```css
--vintage-cream: #F2F0E6;
--vintage-gold: #9DAF70;
--vintage-copper: #6B7A3A;
```

**Opción 3 - Rosa Vintage:**
```css
--vintage-cream: #FFF5F5;
--vintage-gold: #D4A5A5;
--vintage-copper: #B87D7D;
```

### 2. Añadir tu Información de Contacto (10 minutos)

En `contacto.html`, busca y reemplaza:

```html
<!-- Línea ~65 -->
+34 XXX XXX XXX  →  Tu número real

<!-- Línea ~73 -->
info@languageschool.es  →  Tu email real

<!-- Línea ~81 -->
+34 XXX XXX XXX  →  Tu WhatsApp
```

### 3. Añadir Google Maps (5 minutos)

1. Ve a Google Maps: https://www.google.com/maps
2. Busca: "Calle Luis Carbajal, Jódar"
3. Click en "Compartir" → "Insertar un mapa"
4. Copia el código `<iframe>`
5. En `contacto.html`, busca línea ~143:

```html
<!-- ANTES -->
<div class="mapBox">Próximamente...</div>

<!-- DESPUÉS -->
<div class="mapBox">
  <iframe 
    src="TU_URL_DE_GOOGLE_MAPS" 
    width="100%" 
    height="100%" 
    style="border:0;" 
    allowfullscreen="" 
    loading="lazy">
  </iframe>
</div>
```

### 4. Cambiar el Formulario a uno Real (15 minutos)

El formulario actual usa `mailto:` (abre el email del usuario). Para uno real:

**Opción A - Formspree (Gratis, Fácil):**

1. Ve a https://formspree.io/ y crea cuenta
2. Crea un nuevo form
3. Copia el endpoint (URL)
4. En `contacto.html` línea ~120, cambia:

```html
<!-- ANTES -->
<form action="mailto:TU_EMAIL@DOMINIO.COM" method="post" enctype="text/plain">

<!-- DESPUÉS -->
<form action="https://formspree.io/f/TU_CODIGO" method="POST">
```

**Opción B - EmailJS (Gratis, Más Control):**

1. Ve a https://www.emailjs.com/
2. Sigue su guía de setup
3. Añade el script de EmailJS al HTML
4. Configura el envío con JavaScript

### 5. Personalizar Precios (5 minutos)

En `precios.html`, busca las secciones `.price` y modifica:

```html
<!-- Línea ~48 -->
<div class="money">35€ <span class="small">/ mes</span></div>

<!-- Cambia "35€" por tu precio -->
<div class="money">TU_PRECIO€ <span class="small">/ mes</span></div>
```

### 6. Añadir Redes Sociales (10 minutos)

En el footer de cualquier página, añade:

```html
<div style="display:flex; gap:15px; align-items:center;">
  <a href="https://facebook.com/TU_PERFIL" target="_blank" 
     style="font-size:1.5rem; transition:transform 0.3s;">📘</a>
  <a href="https://instagram.com/TU_PERFIL" target="_blank"
     style="font-size:1.5rem; transition:transform 0.3s;">📷</a>
  <a href="https://youtube.com/TU_CANAL" target="_blank"
     style="font-size:1.5rem; transition:transform 0.3s;">📺</a>
</div>
```

### 7. Optimizar para tu Academia (30 minutos)

**Cambia los textos:**
- Abre cada `.html`
- Busca y reemplaza textos genéricos
- Añade tu filosofía única
- Personaliza los servicios

**Añade fotos reales:**
- Crea carpeta `assets/images/`
- Añade fotos de tu academia
- Inserta en las secciones con:

```html
<img src="assets/images/tu-foto.jpg" 
     alt="Descripción" 
     style="width:100%; border-radius:8px;">
```

## 🎯 Mejoras Avanzadas (Opcionales)

### 1. Añadir Blog
Crea `blog.html` y copia la estructura de las otras páginas.

### 2. Sistema de Reservas
Integra Calendly: https://calendly.com/
```html
<div class="calendly-inline-widget" 
     data-url="https://calendly.com/tu-usuario" 
     style="min-width:320px;height:630px;"></div>
<script src="https://assets.calendly.com/assets/external/widget.js"></script>
```

### 3. Testimonios
En `index.html` añade:

```html
<section>
  <div class="sectionTitle reveal">
    <h2>Lo que dicen nuestros alumnos</h2>
  </div>
  
  <div class="grid2">
    <div class="card reveal">
      <p class="sub">"Excelente academia, profesores muy atentos..."</p>
      <p><strong>- María G.</strong></p>
    </div>
    <!-- Más testimonios... -->
  </div>
</section>
```

### 4. Galería de Fotos
```html
<section>
  <div class="sectionTitle reveal">
    <h2>Nuestras Instalaciones</h2>
  </div>
  
  <div class="grid3">
    <img src="assets/images/foto1.jpg" class="reveal" 
         style="width:100%; height:250px; object-fit:cover; border:3px solid var(--vintage-brown);">
    <img src="assets/images/foto2.jpg" class="reveal"
         style="width:100%; height:250px; object-fit:cover; border:3px solid var(--vintage-brown);">
    <!-- Más fotos... -->
  </div>
</section>
```

## 🔧 Troubleshooting

### "Las animaciones no funcionan"
→ Asegúrate de que `app.js` está cargando correctamente
→ Abre la consola del navegador (F12) y busca errores

### "Los colores no cambian"
→ Limpia la caché del navegador (Ctrl+Shift+R)
→ Asegúrate de editar el archivo correcto

### "El formulario no envía"
→ `mailto:` requiere un cliente de email instalado
→ Usa Formspree o EmailJS para producción

### "La web se ve mal en móvil"
→ La web es responsive, prueba en modo incógnito
→ Limpia caché y cookies

## 📱 Testing

Prueba tu web en:
- ✅ Chrome / Edge
- ✅ Firefox
- ✅ Safari
- ✅ Móvil (modo responsive en DevTools - F12)

## 🎨 Recursos Gratuitos

**Iconos:**
- https://emojipedia.org/ (emoji)
- https://fontawesome.com/ (iconos)

**Imágenes:**
- https://unsplash.com/ (gratis, alta calidad)
- https://pexels.com/ (gratis)

**Fuentes:**
- https://fonts.google.com/ (gratis)

**Colores:**
- https://coolors.co/ (generador de paletas)
- https://color.adobe.com/ (rueda de color)

## 💡 Tips Pro

1. **Mantén el diseño limpio**: No sobrecargues con demasiadas animaciones
2. **Usa fotos reales**: Las fotos de tu academia dan más confianza
3. **Actualiza regularmente**: Añade noticias, eventos, testimonios
4. **Optimiza imágenes**: Usa TinyPNG para reducir peso
5. **Prueba en móvil**: Más del 60% de visitas serán desde móvil

## 🚀 Próximos Pasos

1. [ ] Personaliza colores
2. [ ] Añade tu información de contacto
3. [ ] Configura Google Maps
4. [ ] Añade fotos reales
5. [ ] Configura formulario real
6. [ ] Prueba en diferentes dispositivos
7. [ ] Sube a GitHub
8. [ ] Activa GitHub Pages
9. [ ] ¡Comparte tu web!

---

**¿Necesitas ayuda?** Revisa el README.md o consulta los comentarios en el código.
