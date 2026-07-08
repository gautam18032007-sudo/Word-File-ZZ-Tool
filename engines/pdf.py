"""PDF Engine — converts a DOCX buffer to PDF via LibreOffice headless."""
import os
import subprocess
import tempfile
import time
from pathlib import Path


class PdfError(Exception):
    pass


def docx_to_pdf(docx_bytes: bytes, timeout_sec: int = 30) -> bytes:
    soffice = os.environ.get('LIBREOFFICE_PATH', 'soffice')
    tmp_dir = Path(tempfile.gettempdir())
    stamp = str(int(time.time() * 1000))
    docx_path = tmp_dir / f'zz-{stamp}.docx'
    pdf_path = tmp_dir / f'zz-{stamp}.pdf'

    try:
        docx_path.write_bytes(docx_bytes)
        result = subprocess.run(
            [soffice, '--headless', '--convert-to', 'pdf', '--outdir', str(tmp_dir), str(docx_path)],
            capture_output=True, text=True, timeout=timeout_sec,
        )
        if not pdf_path.exists():
            raise PdfError(
                f'PDF not created. Is LibreOffice installed / LIBREOFFICE_PATH correct?\n{result.stderr}'
            )
        return pdf_path.read_bytes()
    except subprocess.TimeoutExpired as e:
        raise PdfError(f'PDF conversion timed out after {timeout_sec}s') from e
    finally:
        docx_path.unlink(missing_ok=True)
        pdf_path.unlink(missing_ok=True)
