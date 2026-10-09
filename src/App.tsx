import {App} from '@wearables-ui-toolkit/mrbd';
import {ReactRouterNavigationProvider, ReactRouterPageTransition} from '@wearables-ui-toolkit/mrbd/react-router';
import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';
import {EventPage} from './pages/EventPage';
import {HomePager} from './pages/HomePager';
import {LoadingPage} from './pages/LoadingPage';
import {ReviewPage} from './pages/ReviewPage';
import {SetupPage} from './pages/SetupPage';
import {useCalendar} from './state/CalendarProvider';

// Back (Escape) is handled by ReactRouterNavigationProvider: the event and the
// review go back to the pager; on the pager, a tab other than Today goes to
// Today, and Today leaves it to the platform, which closes the app.
export default function CalendarApp() {
  const {phase} = useCalendar();
  return (
    <BrowserRouter>
      <ReactRouterNavigationProvider>
        <App>
          {phase.kind === 'loading' ? (
            <LoadingPage />
          ) : phase.kind === 'setup' ? (
            <SetupPage reason={phase.reason} />
          ) : (
            <ReactRouterPageTransition>
              {({location}) => (
                <Routes location={location}>
                  <Route path="/" element={<HomePager />} />
                  <Route path="/event/:calendarId/:eventId" element={<EventPage />} />
                  <Route path="/review" element={<ReviewPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              )}
            </ReactRouterPageTransition>
          )}
        </App>
      </ReactRouterNavigationProvider>
    </BrowserRouter>
  );
}
