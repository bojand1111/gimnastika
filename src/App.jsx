import { useEffect, useState } from 'react';
import gim from './gim.js';

export default function App() {
  const [verzija, postaviVerziju] = useState('');
  useEffect(() => {
    gim.sistem.verzija().then(postaviVerziju);
  }, []);
  return <h1>Gimnastika {verzija}</h1>;
}
