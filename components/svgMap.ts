import Jpg from '@/assets/svg/jpg.svg';
import Mp3 from '@/assets/svg/mp3.svg';
import Pdf from '@/assets/svg/pdf.svg';
import Unknown from '@/assets/svg/unknown.svg';

// Add new imports for other file types (you'll need to create these SVG files)
import SevenZ from '@/assets/svg/7z.svg';
import Aac from '@/assets/svg/aac.svg';
import Ai from '@/assets/svg/ai.svg';
import Archive from '@/assets/svg/archive.svg';
import Arj from '@/assets/svg/arj.svg';
import Audio from '@/assets/svg/audio.svg';
import Avi from '@/assets/svg/avi.svg';
import Css from '@/assets/svg/css.svg';
import Csv from '@/assets/svg/csv.svg';
import Dbf from '@/assets/svg/dbf.svg';
import Doc from '@/assets/svg/doc.svg';
import Dwg from '@/assets/svg/dwg.svg';
import Exe from '@/assets/svg/exe.svg';
import Fla from '@/assets/svg/fla.svg';
import Flac from '@/assets/svg/flac.svg';
import Gif from '@/assets/svg/gif.svg';
import Html from '@/assets/svg/html.svg';
import Iso from '@/assets/svg/iso.svg';
import Js from '@/assets/svg/js.svg';
import Json from '@/assets/svg/json.svg';
import Mdf from '@/assets/svg/mdf.svg';
import Mp2 from '@/assets/svg/mp2.svg';
import Mp4 from '@/assets/svg/mp4.svg';
import Mxf from '@/assets/svg/mxf.svg';
import Nrg from '@/assets/svg/nrg.svg';
import Png from '@/assets/svg/png.svg';
import Ppt from '@/assets/svg/ppt.svg';
import Psd from '@/assets/svg/psd.svg';
import Rar from '@/assets/svg/rar.svg';
import Rtf from '@/assets/svg/rtf.svg';
import Svg from '@/assets/svg/svg.svg';
import Text from '@/assets/svg/text.svg';
import Tiff from '@/assets/svg/tiff.svg';
import Txt from '@/assets/svg/txt.svg';
import Video from '@/assets/svg/video.svg';
import Wav from '@/assets/svg/wav.svg';
import Wma from '@/assets/svg/wma.svg';
import Xls from '@/assets/svg/xls.svg';
import Xml from '@/assets/svg/xml.svg';
import Yt from '@/assets/svg/yt.svg';
import Zip from '@/assets/svg/zip.svg';
export const svgMap: Record<string, React.FC<any>> = {
  // Default/fallback
  'unknown': Unknown,
  
  // Categories
  'audio': Audio,
  'video': Video,
  'text': Text,
  'archive': Archive,
  
  // Image formats
  'jpg': Jpg,
  'jpe': Jpg,
  'jpeg': Jpg,
  'jfif': Jpg,
  'png': Png,
  'gif': Gif,
  'tiff': Tiff,
  'svg': Svg,
  'psd': Psd,
  'ai': Ai,
  'dwg': Dwg,
  
  // Disk images
  'iso': Iso,
  'mdf': Mdf,
  'nrg': Nrg,
  
  // Archive formats
  'zip': Zip,
  '7z': SevenZ,
  '7zip': SevenZ,
  'arj': Arj,
  'rar': Rar,
  'gz': Archive,
  'gzip': Archive,
  'bz2': Archive,
  'bzip2': Archive,
  'tar': Archive,
  
  // Document formats
  'xls': Xls,
  'doc': Doc,
  'pdf': Pdf,
  'ppt': Ppt,
  'xlsx': Xls,
  'docx': Doc,
  'pdfx': Pdf,
  'pptx': Ppt,
  'rtf': Rtf,
  'txt': Txt,
  'md': Text,
  'markdown': Text,
  'yt': Yt,  
  // Media formats
  'avi': Avi,
  'mp2': Mp2,
  'mp3': Mp3,
  'mp4': Mp4,
  'fla': Fla,
  'mxf': Mxf,
  'wav': Wav,
  'wma': Wma,
  'aac': Aac,
  'flac': Flac,
  
  // Code formats
  'css': Css,
  'csv': Csv,
  'html': Html,
  'json': Json,
  'js': Js,
  'xml': Xml,
  
  // Other formats
  'dbf': Dbf,
  'exe': Exe
};