import { resolveSource } from "./bridge/resolveSource";

// A known component tree with nested elements. Line numbers here are asserted by
// the tests, so if you move these elements, update the expected lines in the test.
export function App() {
  function handleClick(e: React.MouseEvent) {
    const result = resolveSource(e.target as HTMLElement);
    // Observable in the browser too — but the test, not this log, is the signal.
    // eslint-disable-next-line no-console
    console.log("resolveSource:", result);
  }

  return (
    <main onClick={handleClick} className="app-root">
      <h1 className="title">Visual Feedback Tool</h1>
      <section className="panel">
        <p className="lead">
          Click any element to see its <span className="accent">source location</span>.
        </p>
        <button type="button" className="cta">
          A nested button
        </button>
      </section>
    </main>
  );
}
