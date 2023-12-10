import React from 'react';
import App from './app';

const title = 'San Francisco Taxi Pickup';

import { createRoot } from 'react-dom/client';
const container = document.getElementById('app');
const root = createRoot(container); // createRoot(container!) if you use TypeScript
root.render(<App title={title} />)