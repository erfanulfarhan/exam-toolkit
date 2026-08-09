import ial from '../../data/ial.json'
import igcse from '../../data/igcse.json'
import { IalData, IgcseData } from './engine'

/**
 * The parsed boundary dataset.
 *
 * It lives here rather than in `public/` on purpose: the JSON is bundled into
 * the serverless functions, so it is never a URL a visitor can fetch. The API
 * answers questions about the data instead of handing the data over.
 */
export const IAL = ial as unknown as IalData
export const IGCSE = igcse as unknown as IgcseData
