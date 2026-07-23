/* TECNOVA Digital — utilitários de perfil (avatar, personagens, foto) */
(function () {
  // Personagens/avatares ilustrados (imagens da marca, preto/dourado)
  window.TECNOVA_CHARS = [
    "img/avatares/av1.jpg","img/avatares/av2.jpg","img/avatares/av3.jpg",
    "img/avatares/av4.jpg","img/avatares/av5.jpg","img/avatares/av6.jpg",
    "img/avatares/av7.jpg","img/avatares/av8.jpg","img/avatares/av9.jpg",
    "img/avatares/av10.jpg"
  ];

  // Comprime/recorta uma imagem para um quadrado 240px (data URL JPEG)
  window.tecnovaCompress = function (file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("Não foi possível ler a imagem.")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("Ficheiro de imagem inválido.")); };
        img.onload = function () {
          var size = 240, c = document.createElement("canvas");
          c.width = size; c.height = size;
          var ctx = c.getContext("2d"), l = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - l) / 2, (img.height - l) / 2, l, l, 0, 0, size, size);
          resolve(c.toDataURL("image/jpeg", 0.72));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // Preenche um elemento avatar (foto > personagem > sexo > inicial)
  window.tecnovaApplyAvatar = function (el, dados, fallback) {
    if (!el) return;
    if (dados && dados.foto) { el.innerHTML = '<img src="' + dados.foto + '" alt="">'; return; }
    if (dados && dados.avatarChar) {
      var v = dados.avatarChar;
      if (/^img\//.test(v) || /^data:/.test(v)) { el.innerHTML = '<img src="' + v + '" alt="">'; return; }
      el.innerHTML = ""; el.textContent = v; return; // compatibilidade com emojis antigos
    }
    el.innerHTML = "";
    if (dados && dados.sexo === "feminino") { el.textContent = "👩"; }
    else if (dados && dados.sexo === "masculino") { el.textContent = "👨"; }
    else { el.textContent = ((fallback || "T").charAt(0) || "T").toUpperCase(); }
  };
})();
