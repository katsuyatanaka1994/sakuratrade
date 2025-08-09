import clsx from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * クラス名の型定義
 * string, number, null, boolean, undefined を許可
 */
type ClassValue = string | number | null | boolean | undefined;

/**
 * 複数のクラス名を結合し、Tailwind CSS と競合しないようにマージする関数
 * @param inputs クラス名リスト
 * @returns マージされたクラス名文字列
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
