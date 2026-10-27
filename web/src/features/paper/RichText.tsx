import { Fragment, type ReactNode } from 'react';
import { parseInlineText, parseRichText, type InlinePiece } from './rich-text';
import styles from './RichText.module.css';

export type RenderBlank = (blankIndex: number) => ReactNode;

export function InlineText({ text }: { text: string }) {
  return <InlinePieces pieces={parseInlineText(text)} />;
}

export function RichText({ text, renderBlank }: { text: string; renderBlank?: RenderBlank }) {
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
                        <InlinePieces pieces={cell} renderBlank={renderBlank} />
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
                        <InlinePieces pieces={cell} renderBlank={renderBlank} />
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
                <InlinePieces pieces={line} renderBlank={renderBlank} />
              </Fragment>
            ))}
          </span>
        ),
      )}
    </>
  );
}

type InlinePiecesProps = {
  pieces: InlinePiece[];
  renderBlank?: RenderBlank;
};

function InlinePieces({ pieces, renderBlank }: InlinePiecesProps) {
  return pieces.map((piece, pieceIndex) => {
    if (piece.kind === 'blank') {
      return (
        <Fragment key={pieceIndex}>
          {renderBlank ? (
            renderBlank(piece.blankIndex)
          ) : (
            <span className={styles.emptyBlank} aria-label="blank" />
          )}
        </Fragment>
      );
    }
    if (piece.kind === 'superscript') return <sup key={pieceIndex}>{piece.text}</sup>;
    if (piece.kind === 'subscript') return <sub key={pieceIndex}>{piece.text}</sub>;
    return <Fragment key={pieceIndex}>{piece.text}</Fragment>;
  });
}
