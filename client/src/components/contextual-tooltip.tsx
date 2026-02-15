import React, { useState } from 'react';
import { Info, HelpCircle, CheckCircle } from 'lucide-react';

interface ContextualTooltipProps {
  id: string;
  title: string;
  content: string;
  type?: 'info' | 'help' | 'warning' | 'success';
  placement?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click';
  children: React.ReactNode;
  className?: string;
}

export function ContextualTooltip({
  id,
  title,
  content,
  type = 'info',
  placement = 'top',
  trigger = 'hover',
  children,
  className = ''
}: ContextualTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(`tooltip-dismissed-${id}`) === 'true';
  });

  const showTooltip = () => {
    if (!dismissed) {
      setIsVisible(true);
    }
  };

  const hideTooltip = () => {
    setIsVisible(false);
  };

  const dismissTooltip = () => {
    setDismissed(true);
    setIsVisible(false);
    localStorage.setItem(`tooltip-dismissed-${id}`, 'true');
  };

  const getIcon = () => {
    switch (type) {
      case 'help':
        return <HelpCircle className="h-4 w-4" />;
      case 'success':
        return <CheckCircle className="h-4 w-4" />;
      case 'warning':
        return <Info className="h-4 w-4 text-yellow-400" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getTypeColors = () => {
    switch (type) {
      case 'help':
        return 'bg-blue-800 border-blue-600 text-blue-100';
      case 'success':
        return 'bg-green-800 border-green-600 text-green-100';
      case 'warning':
        return 'bg-yellow-800 border-yellow-600 text-yellow-100';
      default:
        return 'bg-slate-800 border-slate-600 text-slate-100';
    }
  };

  const getPlacementClasses = () => {
    switch (placement) {
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default: // top
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  const getArrowClasses = () => {
    const baseArrow = 'absolute w-0 h-0 border-solid';
    switch (placement) {
      case 'bottom':
        return `${baseArrow} border-l-4 border-r-4 border-b-4 border-transparent border-b-slate-600 top-0 left-1/2 transform -translate-x-1/2 -translate-y-full`;
      case 'left':
        return `${baseArrow} border-t-4 border-b-4 border-l-4 border-transparent border-l-slate-600 right-0 top-1/2 transform translate-x-full -translate-y-1/2`;
      case 'right':
        return `${baseArrow} border-t-4 border-b-4 border-r-4 border-transparent border-r-slate-600 left-0 top-1/2 transform -translate-x-full -translate-y-1/2`;
      default: // top
        return `${baseArrow} border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-600 bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full`;
    }
  };

  if (dismissed) {
    return <>{children}</>;
  }

  const eventHandlers = trigger === 'hover' 
    ? { onMouseEnter: showTooltip, onMouseLeave: hideTooltip }
    : { onClick: () => setIsVisible(!isVisible) };

  return (
    <div className={`relative inline-block ${className}`} {...eventHandlers}>
      {children}
      
      {isVisible && (
        <div className={`absolute z-50 ${getPlacementClasses()}`}>
          <div className={`relative max-w-xs p-3 rounded-lg border shadow-lg ${getTypeColors()}`}>
            {/* Arrow */}
            <div className={getArrowClasses()}></div>
            
            {/* Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                {getIcon()}
                <h4 className="font-medium text-sm">{title}</h4>
              </div>
              <button 
                onClick={dismissTooltip}
                className="text-slate-400 hover:text-white text-xs ml-2"
              >
                ✕
              </button>
            </div>
            
            {/* Content */}
            <p className="text-xs leading-relaxed">{content}</p>
            
            {/* Got it button */}
            <button
              onClick={dismissTooltip}
              className="mt-2 text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContextualTooltip;