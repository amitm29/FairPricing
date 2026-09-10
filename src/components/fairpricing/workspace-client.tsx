'use client';
import dynamic from 'next/dynamic';
const Workspace = dynamic(() => import('./workspace'), {ssr: false, loading: () => <div style={{padding: 48, fontFamily: 'sans-serif', color: '#087f72'}}>Opening your FairPricing workspace…</div>});
export function WorkspaceClient({comparison = false}: {comparison?: boolean}) { return <Workspace comparison={comparison}/>; }
