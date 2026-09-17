const fs = require('fs');

let content = fs.readFileSync('src/components/MediaDetailModal.tsx', 'utf8');

// Replace duplicate/conflicting Tailwind classes that were created by stripping prefixes
content = content.replace(/px-4 px-[0-9]+/g, 'px-4');
content = content.replace(/-mt-16 -mt-[0-9]+/g, '-mt-16');
content = content.replace(/flex-col flex-row/g, 'flex-col');
content = content.replace(/items-end justify-between gap-4 gap-[0-9]+/g, 'items-start gap-4'); // Mobile usually items-start
content = content.replace(/text-3xl text-[a-z0-9-]+ text-[a-z0-9-]+/g, 'text-3xl');
content = content.replace(/gap-6 gap-[0-9]+/g, 'gap-6');
content = content.replace(/flex-row flex-wrap flex-col gap-2 gap-[0-9]+ justify-start min-w-\[[0-9]+px\]/g, 'flex-col gap-2 w-full');
content = content.replace(/flex-1 min-w-\[[0-9]+px\] flex-none/g, 'w-full');
content = content.replace(/gap-2 gap-[0-9]+/g, 'gap-2');
content = content.replace(/w-\[[0-9]+px\] w-[0-9]+/g, 'w-[120px]');
content = content.replace(/h-8 h-[0-9]+/g, 'h-8');
content = content.replace(/w-8 w-[0-9]+/g, 'w-8');
content = content.replace(/w-3 w-[0-9]+/g, 'w-3');
content = content.replace(/h-3 h-[0-9]+/g, 'h-3');
content = content.replace(/mr-1 mr-[0-9]+/g, 'mr-1');
content = content.replace(/text-[a-z]+ text-[a-z]+/g, function(match) {
  // if text-sm text-base -> text-sm
  if (match === 'text-sm text-base') return 'text-sm';
  if (match === 'text-xs text-sm') return 'text-xs';
  if (match === 'text-3xl text-4xl text-5xl') return 'text-3xl';
  return match;
});
content = content.replace(/grid-cols-[0-9]+ grid-cols-[0-9]+/g, 'grid-cols-1');
content = content.replace(/grid-cols-[0-9]+ grid-cols-[0-9]+ grid-cols-[0-9]+/g, 'grid-cols-1');
content = content.replace(/col-span-[0-9]+/g, '');
content = content.replace(/p-2 p-[0-9]+/g, 'p-4');
content = content.replace(/-mx-2 -mx-[0-9]+/g, '-mx-4');
content = content.replace(/rounded-xl rounded-[0-9]+xl/g, 'rounded-xl');
content = content.replace(/items-center items-start/g, 'items-center');
content = content.replace(/gap-3 gap-[0-9]+/g, 'gap-3');
content = content.replace(/flex-col flex-row items-center justify-between/g, 'flex-col items-start gap-4');
content = content.replace(/grid grid-cols-2 grid-cols-3 grid-cols-4/g, 'flex flex-col');
content = content.replace(/grid grid-cols-1 gap-8/g, 'flex flex-col gap-6');
content = content.replace(/relative px-10 -mt-16/g, 'relative px-4 -mt-16');

fs.writeFileSync('src/components/MediaDetailModal.tsx', content);
