/* Uma Mão — interações */
(() => {
  "use strict";

  const WHATSAPP = "5521972283893";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // navegadores sem IntersectionObserver: mostra tudo de cara
  if (!("IntersectionObserver" in window)) {
    $$("[data-reveal]").forEach((el) => el.classList.add("is-in"));
    window.IntersectionObserver = class { observe() {} unobserve() {} };
  }

  const waLink = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
  const openWhatsApp = (text) => {
    const win = window.open(waLink(text), "_blank", "noopener");
    if (!win) window.location.href = waLink(text);
  };

  /* ---------- Toast ---------- */
  const toastEl = $("[data-toast]");
  let toastTimer;
  const toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-shown"), 3200);
  };

  /* ---------- Loader ---------- */
  const body = document.body;
  let seen = false;
  try { seen = sessionStorage.getItem("um-seen") === "1"; } catch (e) { /* storage indisponível */ }

  const finishLoading = () => {
    body.classList.remove("is-loading");
    body.classList.add("is-loaded");
    try { sessionStorage.setItem("um-seen", "1"); } catch (e) { /* ok */ }
  };

  if (seen || reduced) {
    body.classList.add("skip-loader");
    requestAnimationFrame(finishLoading);
  } else {
    const minTime = new Promise((r) => setTimeout(r, 1500));
    const loaded = new Promise((r) => (document.readyState === "complete" ? r() : window.addEventListener("load", r, { once: true })));
    const cap = new Promise((r) => setTimeout(r, 3500));
    Promise.race([Promise.all([minTime, loaded]), cap]).then(finishLoading);
  }

  $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ---------- Proteção leve das imagens ---------- */
  document.addEventListener("contextmenu", (e) => {
    if (e.target.tagName === "IMG") {
      e.preventDefault();
      toast("As artes são autorais e protegidas ✦");
    }
  });
  document.addEventListener("dragstart", (e) => { if (e.target.tagName === "IMG") e.preventDefault(); });

  /* ---------- Nav ---------- */
  const nav = $("[data-nav]");
  const burger = $("[data-burger]");
  const menu = $("[data-menu]");

  const setMenu = (open) => {
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    document.documentElement.style.overflow = open ? "hidden" : "";
  };
  burger.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("is-open")) setMenu(false); });

  // link ativo
  const navLinks = $$(".nav__links a");
  const sections = navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  const activeIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${en.target.id}`));
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  sections.forEach((s) => activeIO.observe(s));

  /* ---------- Reveal ---------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("is-in");
      revealIO.unobserve(en.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: .08 });

  $$("[data-reveal]").forEach((el) => {
    // escalonamento entre irmãos
    const siblings = $$(":scope > [data-reveal]", el.parentElement);
    const i = siblings.indexOf(el);
    if (i > 0) el.style.setProperty("--d", `${Math.min(i, 6) * 0.08}s`);
    revealIO.observe(el);
  });

  /* ---------- Manifesto: palavras acendem com o scroll ---------- */
  const scrub = $("[data-scrub-words]");
  let scrubWords = [];
  if (scrub) {
    const wrap = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
            else {
              const s = document.createElement("span");
              s.className = "w";
              s.textContent = part;
              frag.appendChild(s);
            }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) wrap(child);
      });
    };
    wrap(scrub);
    scrubWords = $$(".w", scrub);
    if (reduced) scrubWords.forEach((w) => w.classList.add("on"));
  }

  /* ---------- Linhas que se desenham ---------- */
  const drawPaths = $$("[data-draw]").map((p) => {
    const len = Math.ceil(p.getTotalLength());
    p.style.setProperty("--len", len);
    return { el: p, len };
  });

  /* ---------- Loop de scroll ---------- */
  const parallaxEls = $$("[data-parallax]");
  const stepsEl = $("[data-steps]");
  const stepItems = stepsEl ? $$(".step", stepsEl) : [];
  const stepBar = stepsEl ? $(".steps__progress", stepsEl) : null;
  const heroVisual = $("[data-hero-visual]");
  const fab = $(".wa-fab");
  const mobileBar = $("[data-mobile-bar]");
  const agendar = $("#agendar");
  let lastY = window.scrollY;
  let ticking = false;

  const progressOf = (el, start = 1, end = 0) => {
    // 0 quando o topo do el está em start*vh, 1 quando o fundo está em end*vh
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const total = r.height + vh * (start - end);
    return clamp((vh * start - r.top) / total, 0, 1);
  };

  const onScroll = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;

    nav.classList.toggle("is-scrolled", y > 30);
    nav.classList.toggle("is-hidden", y > lastY && y > vh * .8 && !menu.classList.contains("is-open"));
    lastY = y;

    // CTAs flutuantes: aparecem após o hero e somem sobre o formulário
    const r = agendar.getBoundingClientRect();
    const overForm = r.top < vh * .6 && r.bottom > vh * .3;
    const show = y > vh * .7 && !overForm;
    fab.classList.toggle("is-visible", show);
    mobileBar.classList.toggle("is-visible", show);

    if (reduced) return;

    if (scrubWords.length) {
      const p = progressOf(scrub, .85, .45);
      const n = Math.round(p * scrubWords.length * 1.05);
      scrubWords.forEach((w, i) => w.classList.toggle("on", i < n));
    }

    drawPaths.forEach(({ el, len }) => {
      const p = progressOf(el, .95, .35);
      el.style.strokeDashoffset = String(len * (1 - p));
    });

    parallaxEls.forEach((el) => {
      const f = parseFloat(el.dataset.parallax) || .1;
      const r2 = el.getBoundingClientRect();
      const c = (r2.top + r2.height / 2 - vh / 2) / vh;
      const img = el.firstElementChild;
      if (img) img.style.transform = `translate3d(0, ${(-c * f * 100).toFixed(2)}%, 0)`;
    });

    if (stepBar) {
      const p = progressOf(stepsEl, .75, .55);
      stepBar.style.setProperty("--p", p.toFixed(3));
      stepItems.forEach((s, i) => s.classList.toggle("is-lit", p >= i / stepItems.length + .02 || p >= .99));
    }

    if (heroVisual && y < vh * 1.2) {
      heroVisual.style.transform = window.innerWidth > 960 ? `translate3d(0, ${y * .12}px, 0)` : "";
    }
  };

  const requestTick = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  };
  window.addEventListener("scroll", requestTick, { passive: true });
  window.addEventListener("resize", requestTick);
  onScroll();

  /* ---------- Hero: profundidade com o mouse ---------- */
  if (heroVisual && finePointer && !reduced) {
    const cards = $$("[data-depth]", heroVisual);
    let tx = 0, ty = 0, cx = 0, cy = 0, raf;
    const loop = () => {
      cx += (tx - cx) * .07;
      cy += (ty - cy) * .07;
      cards.forEach((c) => {
        const d = parseFloat(c.dataset.depth);
        c.style.translate = `${(cx * d * 18).toFixed(2)}px ${(cy * d * 18).toFixed(2)}px`;
      });
      if (Math.abs(tx - cx) > .001 || Math.abs(ty - cy) > .001) raf = requestAnimationFrame(loop);
      else raf = null;
    };
    $(".hero").addEventListener("pointermove", (e) => {
      tx = (e.clientX / window.innerWidth - .5) * 2;
      ty = (e.clientY / window.innerHeight - .5) * 2;
      if (!raf) raf = requestAnimationFrame(loop);
    });
  }

  /* ---------- Cursor ---------- */
  if (finePointer && !reduced) {
    const cursor = $(".cursor");
    const dot = $(".cursor__dot");
    const ring = $(".cursor__ring");
    let mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener("pointermove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    }, { passive: true });
    const follow = () => {
      rx += (mx - rx) * .18;
      ry += (my - ry) * .18;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(follow);
    };
    follow();
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("a, button, label, summary, input, select, textarea, [data-cursor]");
      cursor.classList.toggle("is-view", !!(t && t.dataset.cursor === "ver"));
      cursor.classList.toggle("is-hover", !!t && t.dataset.cursor !== "ver");
    });
    document.addEventListener("pointerleave", () => { mx = my = -100; });
  }

  /* ---------- Botões magnéticos ---------- */
  if (finePointer && !reduced) {
    $$("[data-magnetic]").forEach((btn) => {
      btn.addEventListener("pointermove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * .22}px, ${y * .3}px)`;
      });
      btn.addEventListener("pointerleave", () => { btn.style.transform = ""; });
    });
  }

  /* ---------- Lightbox ---------- */
  const workMeta = [
    { title: "Fênix", meta: "Estilo abstrato · agulhas 3RL 9RL 7RM · coxa" },
    { title: "Bocolho evolution", meta: "Agulhas 3RL 9RL · ombro / braço" },
    { title: "Latinha com Frô", meta: "Agulha 3RL · braço" },
    { title: "Máscaras de Hannya", meta: "Agulhas 9RL 7RM · coxa" },
    { title: "Guaraná", meta: "Agulhas 3RL · braço" },
    { title: "Ayrton Senna · McLaren", meta: "Agulhas 3RL 7RM 9RM · antebraço" },
  ];
  // a imagem vem da própria galeria (uma única fonte)
  const works = $$("[data-work]").map((btn) => ({
    src: $("img", btn).getAttribute("src"),
    ...workMeta[Number(btn.dataset.work)],
  }));
  const lb = $("[data-lightbox]");
  const lbImg = $("[data-lb-img]", lb);
  let lbIndex = 0;

  const renderLb = () => {
    const w = works[lbIndex];
    lbImg.src = w.src;
    lbImg.alt = w.title;
    lbImg.style.animation = "none";
    void lbImg.offsetWidth;
    lbImg.style.animation = "";
    $("[data-lb-title]", lb).textContent = w.title;
    $("[data-lb-meta]", lb).textContent = w.meta;
    $("[data-lb-index]", lb).textContent = `${String(lbIndex + 1).padStart(2, "0")} / ${String(works.length).padStart(2, "0")}`;
  };
  const openLb = (i) => {
    lbIndex = i;
    renderLb();
    lb.showModal();
    document.documentElement.style.overflow = "hidden";
  };
  const closeLb = () => lb.close();
  const stepLb = (d) => { lbIndex = (lbIndex + d + works.length) % works.length; renderLb(); };

  $$("[data-work]").forEach((btn) => btn.addEventListener("click", () => openLb(Number(btn.dataset.work))));
  $("[data-lb-close]", lb).addEventListener("click", closeLb);
  $("[data-lb-prev]", lb).addEventListener("click", () => stepLb(-1));
  $("[data-lb-next]", lb).addEventListener("click", () => stepLb(1));
  $("[data-lb-cta]", lb).addEventListener("click", () => closeLb());
  lb.addEventListener("close", () => { document.documentElement.style.overflow = ""; });
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") stepLb(-1);
    if (e.key === "ArrowRight") stepLb(1);
  });
  let touchX = null;
  lb.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) stepLb(dx < 0 ? 1 : -1);
    touchX = null;
  });

  /* ---------- Wizard de agendamento ---------- */
  const form = $("[data-wizard]");
  const steps = $$("[data-step]", form);
  const btnPrev = $("[data-prev]", form);
  const btnNext = $("[data-next]", form);
  const btnSend = $("[data-send]", form);
  const bar = $("[data-wizard-bar]", form);
  const count = $("[data-wizard-count]", form);
  const flashField = $("[data-flash-field]", form);
  const ideia = $("#ideia", form);
  const range = $("#tamanho", form);
  const sizeOut = $("[data-size-out]", form);
  const preview = $("[data-preview]", form);
  const nome = $("#nome", form);
  let current = 1;

  const val = (name) => (form.elements[name] && form.elements[name].value) || "";
  const tipo = () => $("input[name=tipo]:checked", form).value;
  const flow = () => (tipo() === "Dúvida" ? [1, 2, 4, 5] : [1, 2, 3, 4, 5]);

  const updateRange = () => {
    const v = Number(range.value);
    sizeOut.textContent = `${v} cm`;
    const pct = ((v - range.min) / (range.max - range.min)) * 100;
    range.style.setProperty("--fill", `${pct}%`);
  };
  range.addEventListener("input", updateRange);
  updateRange();

  const updateCount = () => { $("[data-count-for=ideia]", form).textContent = `${ideia.value.length}/900`; };
  ideia.addEventListener("input", updateCount);

  $$("[data-add]", form).forEach((chip) => chip.addEventListener("click", () => {
    const add = chip.dataset.add;
    ideia.value = ideia.value ? `${ideia.value.trim()}\n${add}` : add;
    ideia.focus();
    ideia.setSelectionRange(ideia.value.length, ideia.value.length);
    updateCount();
  }));

  const syncTipo = () => {
    const t = tipo();
    flashField.hidden = t !== "Arte disponível";
    const legend = $("[data-idea-legend]", form);
    const hint = $("[data-idea-hint]", form);
    const suggest = $("[data-suggest]", form);
    if (t === "Arte disponível") {
      legend.textContent = "Algum detalhe pra eu saber?";
      hint.textContent = "Opcional: ajustes de tamanho, local, dúvidas sobre a arte…";
      ideia.placeholder = "Ex.: queria no antebraço, uns 13 cm";
      suggest.hidden = true;
    } else if (t === "Dúvida") {
      legend.textContent = "Qual a sua dúvida?";
      hint.textContent = "Pode perguntar à vontade, eu respondo no WhatsApp.";
      ideia.placeholder = "Ex.: dói muito tatuar na costela?";
      suggest.hidden = true;
    } else {
      legend.textContent = "Me conta a ideia";
      hint.textContent = "Pode ser um sentimento, um desenho, uma memória e até mesmo uma música.";
      ideia.placeholder = "Ex.: quero algo que lembre o mar de Arpoador, com fumaça e linhas finas…";
      suggest.hidden = false;
    }
  };
  $$("input[name=tipo]", form).forEach((r) => r.addEventListener("change", syncTipo));

  const buildMessage = () => {
    const t = tipo();
    const lines = [];
    if (t === "Dúvida") {
      lines.push("Oii, Maria! Vim pelo site e tenho uma dúvida ✨", "");
      lines.push(`*Dúvida:* ${ideia.value.trim()}`);
    } else {
      lines.push("Oii, Maria! Vim pelo site e quero tatuar ✨", "");
      if (t === "Arte disponível") {
        lines.push(`*Quero reservar:* ${val("flash")}`);
        if (ideia.value.trim()) lines.push(`*Observações:* ${ideia.value.trim()}`);
      } else {
        lines.push("*Tipo:* Projeto autoral");
        lines.push(`*Ideia:* ${ideia.value.trim()}`);
      }
      lines.push(`*Local:* ${val("local")}`);
      lines.push(`*Tamanho aprox.:* ${range.value} cm`);
      lines.push(`*Primeira tattoo:* ${val("primeira")}`);
    }
    const dias = $$("input[name=dias]:checked", form).map((i) => i.value).join(", ");
    lines.push(`*Prazo:* ${val("prazo")}${dias ? ` · ${dias}` : ""}`);
    lines.push(`*Nome:* ${nome.value.trim()}`);
    return lines.join("\n");
  };

  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const renderPreview = () => {
    preview.innerHTML = escapeHtml(buildMessage()).replace(/\*(.+?)\*/g, "<b>$1</b>");
  };

  const validate = (n) => {
    if (n === 2 && tipo() !== "Arte disponível" && ideia.value.trim().length < 3) {
      ideia.focus();
      toast(tipo() === "Dúvida" ? "Escreve sua dúvida rapidinho 😊" : "Me conta um pouquinho da ideia 😊");
      return false;
    }
    if (n === 4) {
      const ok = nome.value.trim().length > 1;
      nome.closest(".field").classList.toggle("has-error", !ok);
      if (!ok) { nome.focus(); return false; }
    }
    return true;
  };
  nome.addEventListener("input", () => nome.closest(".field").classList.remove("has-error"));

  const goTo = (n, back = false) => {
    const f = flow();
    current = n;
    steps.forEach((s) => {
      const active = Number(s.dataset.step) === n;
      s.classList.toggle("is-active", active);
      s.classList.toggle("is-back", active && back);
    });
    const idx = f.indexOf(n);
    bar.style.width = `${((idx + 1) / f.length) * 100}%`;
    count.textContent = `passo ${idx + 1} de ${f.length}`;
    btnPrev.disabled = idx === 0;
    const last = idx === f.length - 1;
    btnNext.hidden = last;
    btnSend.hidden = !last;
    if (last) renderPreview();
  };

  btnNext.addEventListener("click", () => {
    if (!validate(current)) return;
    const f = flow();
    const next = f[f.indexOf(current) + 1];
    if (next) goTo(next);
    const top = form.getBoundingClientRect().top;
    if (top < 0) form.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  });
  btnPrev.addEventListener("click", () => {
    const f = flow();
    const prev = f[f.indexOf(current) - 1];
    if (prev) goTo(prev, true);
  });
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && !btnNext.hidden) {
      e.preventDefault();
      btnNext.click();
    }
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    openWhatsApp(buildMessage());
    toast("Abrindo o WhatsApp… é só enviar! ✦");
  });

  // Reservar arte disponível → wizard já preenchido
  $$("[data-reserve]").forEach((btn) => btn.addEventListener("click", () => {
    $("input[name=tipo][value='Arte disponível']", form).checked = true;
    form.elements.flash.value = btn.dataset.reserve;
    range.value = btn.dataset.size || range.value;
    updateRange();
    syncTipo();
    goTo(2);
    agendar.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    toast(`${btn.dataset.reserve} selecionada ✦`);
  }));

  syncTipo();
  goTo(1);

  /* ---------- Ficha de anamnese ---------- */
  const sheet = $("[data-anamnese]");
  const aForm = $("[data-anamnese-form]");
  const healthWrap = $("[data-health]", aForm);
  const consentWrap = $("[data-consents]", aForm);

  const health = [
    "Maior de 18 anos",
    "Grávida ou lactante",
    "Uso de Roacutan / isotretinoína nos últimos 6 meses",
    "Possui alguma doença transmissível (hepatite, HIV etc.)",
    "Diabético",
    "Faz uso de remédio anticoagulante",
    "Ingeriu bebida alcoólica ou drogas nas últimas 24h",
    "Se alimentou bem nas últimas 3h",
  ];
  const consents = [
    {
      key: "imagem", label: "Uso de imagem",
      text: "Autorizo a captação e o uso da minha imagem (fotos e vídeos da execução e do resultado da tatuagem) para divulgação no portfólio da artista e em suas redes sociais profissionais.",
      options: ["Sim, eu autorizo.", "Não, eu não autorizo."],
    },
    {
      key: "arte", label: "Aprovação da arte",
      text: "Declaro que estou 100% de acordo com a arte, tamanho, traço, cores e local de aplicação do desenho que será tatuado no meu corpo, tendo revisado o decalque antes do início do procedimento.",
      options: ["Sim, estou de acordo.", "Não, não estou de acordo."],
    },
    {
      key: "veracidade", label: "Veracidade",
      text: "Declaro que todas as informações acima são verdadeiras e que não omiti nenhum dado sobre a minha saúde.",
      options: ["Sim, não omiti nenhum dado.", "Não, eu omiti."],
    },
  ];

  healthWrap.innerHTML = health.map((h, i) => `
    <label class="health__item"><input type="checkbox" name="saude" value="${i}"><span class="health__box" aria-hidden="true"></span><span>${h}</span></label>`).join("");

  consentWrap.innerHTML = consents.map((c) => `
    <fieldset class="consent" data-consent="${c.key}">
      <legend><strong>${c.label}:</strong> ${c.text}</legend>
      <div class="consent__opts">
        ${c.options.map((o) => `<label class="consent__opt"><input type="radio" name="c-${c.key}" value="${o}"><span>${o}</span></label>`).join("")}
      </div>
    </fieldset>`).join("");

  // máscaras
  const digits = (v) => v.replace(/\D/g, "");
  const masks = {
    cpf: (v) => digits(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2"),
    tel: (v) => {
      const d = digits(v).slice(0, 11);
      if (d.length <= 2) return d.length ? `(${d}` : "";
      if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
      const split = d.length === 11 ? 7 : 6;
      return `(${d.slice(0, 2)}) ${d.slice(2, split)}-${d.slice(split)}`;
    },
  };
  $$("[data-mask]", aForm).forEach((input) => input.addEventListener("input", () => {
    input.value = masks[input.dataset.mask](input.value);
  }));

  const validCPF = (v) => {
    const d = digits(v);
    if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
    const check = (len) => {
      let sum = 0;
      for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
      const r = (sum * 10) % 11;
      return (r === 10 ? 0 : r) === Number(d[len]);
    };
    return check(9) && check(10);
  };

  const ageFrom = (iso) => {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) a--;
    return a;
  };

  const markField = (el, bad) => {
    const box = el.closest(".field, .health, .consent");
    if (box) box.classList.toggle("has-error", bad);
    return bad;
  };
  aForm.addEventListener("input", (e) => {
    const box = e.target.closest(".field, .health, .consent");
    if (box) box.classList.remove("has-error");
  });

  const openSheet = () => {
    sheet.showModal();
    document.documentElement.style.overflow = "hidden";
  };
  $$("[data-open-anamnese]").forEach((b) => b.addEventListener("click", openSheet));
  $("[data-sheet-close]", sheet).addEventListener("click", () => sheet.close());
  sheet.addEventListener("close", () => { document.documentElement.style.overflow = ""; });
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });

  aForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const el = aForm.elements;
    const err = $("[data-anamnese-error]", aForm);
    const nomeA = el.nome.value.trim();
    const nasc = el.nascimento.value;
    const cpf = el.cpf.value.trim();
    const tel = el.telefone.value.trim();
    let insta = el.instagram.value.trim().replace(/^@+/, "");
    const checked = $$("input[name=saude]:checked", aForm).map((i) => Number(i.value));

    const problems = [
      markField(el.nome, nomeA.length < 3),
      markField(el.nascimento, !nasc),
      markField(el.cpf, !validCPF(cpf)),
      markField(el.instagram, insta.length < 2),
      markField(healthWrap, checked.length === 0),
      ...consents.map((c) => markField($(`[data-consent=${c.key}]`, consentWrap), !$(`input[name=c-${c.key}]:checked`, aForm))),
    ];
    const bad = problems.some(Boolean);
    err.textContent = el.cpf.value && !validCPF(cpf)
      ? "Confere o CPF, parece que tem algum número errado."
      : "Faltou preencher alguma coisa marcada com *, dá uma olhadinha nos campos destacados.";
    err.classList.toggle("is-shown", bad);
    if (bad) {
      $(".has-error", aForm).scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      return;
    }

    const [y, m, d] = nasc.split("-");
    const age = ageFrom(nasc);
    const lines = [
      "*Ficha de anamnese — Uma Mão* ✦", "",
      `*Nome:* ${nomeA}`,
      `*Nascimento:* ${d}/${m}/${y}${age !== null ? ` (${age} anos)` : ""}`,
      `*CPF:* ${cpf}`,
    ];
    if (tel) lines.push(`*Telefone:* ${tel}`);
    lines.push(`*Instagram:* @${insta}`, "", "*Histórico de saúde:*");
    health.forEach((h, i) => lines.push(`${checked.includes(i) ? "☑" : "☐"} ${h}`));
    lines.push("", `*Alergias / medicamentos:* ${el.alergias.value.trim() || "nada informado"}`, "");
    consents.forEach((c) => lines.push(`*${c.label}:* ${$(`input[name=c-${c.key}]:checked`, aForm).value}`));
    lines.push("*Cuidados pós-tattoo:* ciente e de acordo com as orientações de cicatrização.");

    openWhatsApp(lines.join("\n"));
    sheet.close();
    toast("Ficha pronta! Só enviar no WhatsApp ✦");
  });
})();

