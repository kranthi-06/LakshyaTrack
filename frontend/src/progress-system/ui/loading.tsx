import type { CSSProperties } from 'react';

function joinClassNames(...classNames: Array<string | undefined>): string {
  return classNames.filter(Boolean).join(' ');
}

export function SkeletonBlock({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={joinClassNames(
        'animate-pulse rounded-xl bg-slate-200/75 dark:bg-white/10',
        className,
      )}
      style={style}
    />
  );
}

export function SkeletonCircle({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <SkeletonBlock
      className={joinClassNames('rounded-full', className)}
      style={{ width: size, height: size }}
    />
  );
}

export function SkeletonText({
  lines,
  className,
}: {
  lines: string[];
  className?: string;
}) {
  return (
    <div className={joinClassNames('space-y-2', className)}>
      {lines.map((lineClassName, index) => (
        <SkeletonBlock key={`${lineClassName}-${index}`} className={joinClassNames('h-3', lineClassName)} />
      ))}
    </div>
  );
}
