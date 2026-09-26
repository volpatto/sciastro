// Keep configuration and download mount paths in sync. The final assertion
// requires the actual end of input; `$` would also allow a trailing newline.
export const basePathPattern = /^\/(?:[a-zA-Z0-9_~-]+\/)*(?![\s\S])/;
