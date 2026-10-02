import {RequestError} from './notebook-server';
// Older station group renderers only know three stations. Never give them a
// fourth station that they would silently omit from the common check.
export function stationClientResponse<T>(request:Request|undefined,data:T):T{
 if(request?.headers.get('X-Labula-Stations')!=='4'&&JSON.stringify(data).includes('"stationId":"station-4"'))throw new RequestError('This check uses Station 4. Reload the app to continue. Your saved local changes remain on this device.',426,'client_update_required');
 return data;
}
