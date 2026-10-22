import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import { classNames } from '../lib/class-names';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'medium' | 'large';

type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps;
type ButtonLinkProps = LinkProps & ButtonStyleProps;

export function Button({
  variant,
  size,
  fullWidth,
  className,
  type = 'button',
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassNames({ variant, size, fullWidth }, className)}
      {...buttonProps}
    />
  );
}

export function ButtonLink({ variant, size, fullWidth, className, ...linkProps }: ButtonLinkProps) {
  return (
    <Link className={buttonClassNames({ variant, size, fullWidth }, className)} {...linkProps} />
  );
}

function buttonClassNames(
  { variant = 'primary', size = 'medium', fullWidth = false }: ButtonStyleProps,
  extraClassName: string | undefined,
): string {
  return classNames(
    styles.button,
    styles[variant],
    size === 'large' && styles.large,
    fullWidth && styles.fullWidth,
    extraClassName,
  );
}
