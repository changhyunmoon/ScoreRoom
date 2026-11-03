/** Blob이나 data URL을 파일로 저장한다. 만든 Object URL은 잠시 뒤 해제한다 */
export function saveFile(data: Blob | string, fileName: string) {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof data !== 'string') setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
