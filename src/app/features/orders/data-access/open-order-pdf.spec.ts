import { openOrderPdf } from './open-order-pdf';

describe('openOrderPdf', () => {
  const pdf = { url: 'https://api.example/signed', generated_at: '2026-09-26T12:00:00Z', expires_at: '2026-09-26T12:30:00Z' };

  afterEach(() => vi.restoreAllMocks());

  it('opens the tab before generating, then points it at the signed url', async () => {
    const tab = { location: { href: '' }, close: vi.fn() };
    const calls: string[] = [];
    vi.spyOn(window, 'open').mockImplementation(() => {
      calls.push('open');
      return tab as unknown as Window;
    });
    const store = {
      generatePdf: vi.fn(async () => {
        calls.push('generate');
        return pdf;
      }),
      markPdfGenerated: vi.fn(),
    };

    await openOrderPdf(store, 'order-1');

    expect(calls).toEqual(['open', 'generate']);
    expect(store.generatePdf).toHaveBeenCalledWith('order-1');
    expect(store.markPdfGenerated).toHaveBeenCalledWith('order-1', pdf.generated_at);
    expect(tab.location.href).toBe(pdf.url);
  });

  it('closes the tab and rethrows when generation fails', async () => {
    const tab = { location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const store = { generatePdf: vi.fn(async () => Promise.reject(new Error('boom'))), markPdfGenerated: vi.fn() };

    await expect(openOrderPdf(store, 'order-1')).rejects.toThrow('boom');
    expect(tab.close).toHaveBeenCalled();
    expect(store.markPdfGenerated).not.toHaveBeenCalled();
  });
});
