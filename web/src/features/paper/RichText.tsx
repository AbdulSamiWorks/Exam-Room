import { Fragment } from 'react';
import { parseInlineText, parseRichText, type InlinePiece } from './rich-text';
import styles from './RichText.module.css';

export function InlineText({ text }: { text: string }) {
  return <InlinePieces pieces={parseInlineText(text)} />;
}

export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRichText(text).map((block, blockIndex) =>
        block.kind === 'table' ? (
          <div key={blockIndex} className={styles.tableScroller}>
            <table className={styles.table}>
              {block.headerRow && (
                <thead>
                  <tr>
                    {block.headerRow.map((cell, cellIndex) => (
                      <th key={cellIndex}>
                        <InlinePieces pieces={cell} />
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {block.bodyRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>
                        <InlinePieces pieces={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <span key={blockIndex} className={styles.textBlock}>
            {block.lines.map((line, lineIndex) => (
              <Fragment key={lineIndex}>
                {lineIndex > 0 && '\n'}
                <InlinePieces pieces={line} />
              </Fragment>
            ))}
          </span>
        ),
      )}
    </>
  );
}

function InlinePieces({ pieces }: { pieces: InlinePiece[] }) {
  return pieces.map((piece, pieceIndex) => {
    if (piece.kind === 'superscript') return <sup key={pieceIndex}>{piece.text}</sup>;
    if (piece.kind === 'subscript') return <sub key={pieceIndex}>{piece.text}</sub>;
    return <Fragment key={pieceIndex}>{piece.text}</Fragment>;
  });
}
