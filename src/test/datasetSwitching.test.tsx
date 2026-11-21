import { useState } from 'react';
import { act, cleanup, render, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DatasetScope } from '@/components/layout/DatasetScope';
import { useDatasetLoading } from '@/hooks/useDatasetLoading';
import { addUploadedDataset, getEffectiveSourceId, listDatasetSources, removeSource, setActiveSourceId } from '@/lib/datasetRegistry';
import { clearDatasetCaches, normalizeDataset } from '@/lib/datasetLoader';
import { Button } from '@/components/ui/button';

const sourceIds: string[] = [];
const makeDataset = (name: string, count: number, gene: string) => normalizeDataset({
  metadata: { name },
  cells: Array.from({ length: count }, (_, i) => ({ id: `${name}-${i}`, x: i, y: i, cluster: 0 })),
  clusters: [{ id: 0, name: 'Cell type', color: '#ff0000' }],
  genes: [gene],
  expression: { [gene]: Object.fromEntries(Array.from({ length: count }, (_, i) => [`${name}-${i}`, i + 1])) },
  differentialExpression: [],
});

afterEach(() => {
  cleanup();
  sourceIds.splice(0).forEach(removeSource);
  clearDatasetCaches();
  localStorage.clear();
});

describe('explorer dataset switching', () => {
  it('loads either of two additional datasets and resets dataset-specific selections', async () => {
    const first = addUploadedDataset('First', makeDataset('First', 2, 'G1'));
    const second = addUploadedDataset('Second', makeDataset('Second', 3, 'G2'));
    sourceIds.push(first.id, second.id);
    setActiveSourceId(first.id);

    function Explorer() {
      const { dataset, exprReady } = useDatasetLoading(makeDataset('Fallback', 1, 'F'));
      const [gene, setGene] = useState<string | null>(null);
      return <>
        <output data-testid="loaded">{exprReady ? `${dataset.metadata.name}:${dataset.cells.length}:${dataset.genes.join(',')}:${dataset.expression?.getValues(dataset.genes[0])?.[0]}` : 'loading'}</output>
        <output data-testid="gene">{gene ?? 'none'}</output>
        <Button onClick={() => setGene(dataset.genes[0])}>Select gene</Button>
      </>;
    }

    const view = render(<DatasetScope><Explorer /></DatasetScope>);
    await waitFor(() => expect(view.getByTestId('loaded').textContent).toBe('First:2:G1:1'));
    fireEvent.click(view.getByRole('button', { name: 'Select gene' }));
    expect(view.getByTestId('gene').textContent).toBe('G1');
    act(() => setActiveSourceId(second.id));
    await waitFor(() => expect(view.getByTestId('loaded').textContent).toBe('Second:3:G2:1'));
    expect(view.getByTestId('gene').textContent).toBe('none');
    expect(getEffectiveSourceId()).toBe(second.id);
    expect(listDatasetSources().map(source => source.id)).toEqual(expect.arrayContaining(['built-in', first.id, second.id]));
    act(() => setActiveSourceId(first.id));
    await waitFor(() => expect(view.getByTestId('loaded').textContent).toBe('First:2:G1:1'));
  });
});