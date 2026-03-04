/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Administration from './pages/Administration';
import Analytics from './pages/Analytics';
import Attendance from './pages/Attendance';
import Bulletins from './pages/Bulletins';
import Classes from './pages/Classes';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Exams from './pages/Exams';
import Finance from './pages/Finance';
import Grades from './pages/Grades';
import Homework from './pages/Homework';
import Messages from './pages/Messages';
import Resources from './pages/Resources';
import RoleSelect from './pages/RoleSelect';
import Sanctions from './pages/Sanctions';
import Schedule from './pages/Schedule';
import Staff from './pages/Staff';
import StudentDetail from './pages/StudentDetail';
import Students from './pages/Students';
import Subjects from './pages/Subjects';
import Teachers from './pages/Teachers';
import SchoolYearManager from './pages/SchoolYearManager';
import MobileSaisie from './pages/MobileSaisie';
import EspaceParent from './pages/EspaceParent';
import StudentDashboard360 from './pages/StudentDashboard360';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Administration": Administration,
    "Analytics": Analytics,
    "Attendance": Attendance,
    "Bulletins": Bulletins,
    "Classes": Classes,
    "Dashboard": Dashboard,
    "Events": Events,
    "Exams": Exams,
    "Finance": Finance,
    "Grades": Grades,
    "Homework": Homework,
    "Messages": Messages,
    "Resources": Resources,
    "RoleSelect": RoleSelect,
    "Sanctions": Sanctions,
    "Schedule": Schedule,
    "Staff": Staff,
    "StudentDetail": StudentDetail,
    "Students": Students,
    "Subjects": Subjects,
    "Teachers": Teachers,
    "SchoolYearManager": SchoolYearManager,
    "MobileSaisie": MobileSaisie,
    "EspaceParent": EspaceParent,
    "StudentDashboard360": StudentDashboard360,
}

export const pagesConfig = {
    mainPage: "Administration",
    Pages: PAGES,
    Layout: __Layout,
};