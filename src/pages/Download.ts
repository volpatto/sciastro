import type { APIRoute, GetStaticPaths } from 'astro';
import site from 'virtual:sciastro';
import { notebookResponse, type BuiltNotebookDownload } from '../downloads.js';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = () =>
  (site.downloads ?? []).map((file) => ({
    params: {
      download: file.path
        .slice(`${site.config.base}_sciastro/downloads/`.length)
        .replace(/\.ipynb$/, ''),
    },
    props: { file },
  }));

export const GET: APIRoute = ({ props }) =>
  notebookResponse(props.file as BuiltNotebookDownload);
