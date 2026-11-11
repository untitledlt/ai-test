// Bundle entry: pulls the global alias stylesheet into the build without leaking a CSS import into index.d.ts.
import './tokens.css';
export * from './index';
