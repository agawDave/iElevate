import { Navigate, useLocation, useParams } from 'react-router-dom';

// Topics and their chats live on the Modules page now. Old links keep working:
//   /modules/:moduleId        -> /modules?topic=:moduleId
//   /modules/:moduleId/chat?c=-> /modules?topic=:moduleId&c=...
//   /messages?tab=ongoing     -> /modules?tab=ongoing
export function ModuleRedirect() {
  const { moduleId } = useParams();
  const params = new URLSearchParams(useLocation().search);
  params.set('topic', moduleId);
  params.delete('propose');
  return <Navigate to={`/modules?${params}`} replace />;
}

export function MessagesRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/modules${search}`} replace />;
}
