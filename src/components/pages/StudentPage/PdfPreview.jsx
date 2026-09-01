import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function PdfPreview({ url }) {
  const canvasRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loadingTask = null;

    const renderPdf = async () => {
      try {
        setLoading(true);
        setError(false);

        if (!url) {
          throw new Error(
            "PDF URL is missing."
          );
        }

        console.log(
          "PDF PREVIEW URL:",
          url
        );

        loadingTask =
          pdfjsLib.getDocument({
            url,
            withCredentials: false,
          });

        const pdf =
          await loadingTask.promise;

        if (cancelled) {
          return;
        }

        const page =
          await pdf.getPage(1);

        if (cancelled) {
          return;
        }

        const canvas =
          canvasRef.current;

        if (!canvas) {
          return;
        }

        const context =
          canvas.getContext("2d");

        const containerWidth =
          canvas.parentElement
            ?.clientWidth || 700;

        const originalViewport =
          page.getViewport({
            scale: 1,
          });

        const scale =
          containerWidth /
          originalViewport.width;

        const viewport =
          page.getViewport({
            scale: Math.min(
              scale,
              1.5
            ),
          });

        canvas.width =
          viewport.width;

        canvas.height =
          viewport.height;

        await page.render({
          canvasContext: context,
          viewport,
        }).promise;

        if (cancelled) {
          return;
        }

        setLoading(false);

      } catch (err) {

        console.error(
          "========== PDF PREVIEW ERROR =========="
        );

        console.error(
          "PDF URL:",
          url
        );

        console.error(
          "Error:",
          err
        );

        console.error(
          "Error name:",
          err?.name
        );

        console.error(
          "Error message:",
          err?.message
        );

        console.error(
          "======================================"
        );

        if (!cancelled) {
          setLoading(false);
          setError(true);
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;

      if (loadingTask) {
        try {
          loadingTask.destroy();
        } catch (e) {
          console.warn(
            "Failed to destroy PDF loading task:",
            e
          );
        }
      }
    };
  }, [url]);

  /*
  |--------------------------------------------------------------------------
  | OPEN FULL PDF
  |--------------------------------------------------------------------------
  */

  const handleOpenPdf = () => {
    if (!url) {
      return;
    }

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="pdf-preview-wrapper">

      <button
        type="button"
        className="pdf-preview-container"
        onClick={
          handleOpenPdf
        }
        disabled={
          loading || error
        }
        title="Click to view full PDF"
      >

        {loading && (
          <div className="pdf-preview-loading">

            <div className="pdf-preview-spinner" />

            <span>
              Loading PDF preview...
            </span>

          </div>
        )}

        {error && (
          <div className="pdf-preview-error">

            <div className="pdf-preview-error-icon">
              📄
            </div>

            <strong>
              PDF Preview Unavailable
            </strong>

            <span>
              Unable to preview this PDF.
            </span>

          </div>
        )}

        <canvas
          ref={canvasRef}
          className={`pdf-preview-canvas ${
            loading || error
              ? "pdf-preview-hidden"
              : ""
          }`}
        />

        {!loading &&
          !error && (
            <div className="pdf-preview-click-overlay">

              <span>
                Click to view full PDF
              </span>

            </div>
          )}

      </button>

    </div>
  );
}

export default PdfPreview;