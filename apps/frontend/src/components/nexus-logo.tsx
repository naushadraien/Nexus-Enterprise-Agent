import React from 'react';

export function NexusLogo({ className, size = 24, ...props }: React.SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className} 
      {...props}
    >
      <path d="M4 20V4l16 16V4" />
      <circle cx="4" cy="4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="20" cy="20" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path d="M12 12L4 20" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
      <path d="M12 12L20 4" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}
