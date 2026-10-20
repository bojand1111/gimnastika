import { useEffect, useState } from 'react';

export default function App() {
  const [verzija, postaviVerziju] = useState('');
  useEffect(() => {
    window.gim.sistem.verzija().then(postaviVerziju);
  }, []);
  return <h1>Gimnastika {verzija}</h1>;
}
