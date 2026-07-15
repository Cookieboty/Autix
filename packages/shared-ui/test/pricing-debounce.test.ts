import { debounce } from '../src/pricing/debounce';

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('debounce', () => {
  test('only invokes once for a burst of calls', async () => {
    let calls = 0;
    const fn = debounce(() => { calls += 1; }, 20);
    fn(); fn(); fn();
    await wait(40);
    expect(calls).toBe(1);
  });

  test('passes through the latest arguments', async () => {
    let received: number | undefined;
    const fn = debounce((n: number) => { received = n; }, 20);
    fn(1); fn(2); fn(3);
    await wait(40);
    expect(received).toBe(3);
  });

  test('cancel() prevents a pending call from firing', async () => {
    let calls = 0;
    const fn = debounce(() => { calls += 1; }, 20);
    fn();
    fn.cancel();
    await wait(40);
    expect(calls).toBe(0);
  });
});
