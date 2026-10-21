// Renderer strana: skida {ok, podaci} omot; greska postaje Error sa porukom za korisnika.
function razmotaj(poziv) {
  return async (...args) => {
    const odgovor = await poziv(...args);
    if (!odgovor.ok) throw new Error(odgovor.greska);
    return odgovor.podaci;
  };
}

const gim = new Proxy({}, {
  get(_, modul) {
    return new Proxy({}, {
      get(_, radnja) {
        return razmotaj((...args) => window.gim[modul][radnja](...args));
      },
    });
  },
});

export default gim;
