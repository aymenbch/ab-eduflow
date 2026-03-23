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
import Affectation from './pages/Affectation';
import AffectationEleves from './pages/AffectationEleves';
import Analytics from './pages/Analytics';
import AppLogin from './pages/AppLogin';
import Attendance from './pages/Attendance';
import Bulletins from './pages/Bulletins';
import Classes from './pages/Classes';
import Dashboard from './pages/Dashboard';
import EspaceParent from './pages/EspaceParent';
import Events from './pages/Events';
import Exams from './pages/Exams';
import Finance from './pages/Finance';
import Grades from './pages/Grades';
import Homework from './pages/Homework';
import Messages from './pages/Messages';
import MobileSaisie from './pages/MobileSaisie';
import Pilotage from './pages/Pilotage';
import ProjectsScrum from './pages/ProjectsScrum';
import Resources from './pages/Resources';
import RoleSelect from './pages/RoleSelect';
import Sanctions from './pages/Sanctions';
import Schedule from './pages/Schedule';
import SchoolYearManager from './pages/SchoolYearManager';
import SocialNetwork from './pages/SocialNetwork';
import Staff from './pages/Staff';
import StudentDashboard from './pages/StudentDashboard';
import StudentDashboard360 from './pages/StudentDashboard360';
import StudentDetail from './pages/StudentDetail';
import Students from './pages/Students';
import Subjects from './pages/Subjects';
import Teachers from './pages/Teachers';
import MonProfil from './pages/MonProfil';
import PassageDeClasse from './pages/PassageDeClasse';
import Rooms from './pages/Rooms';
import Visio from './pages/Visio';
import Moyennes from './pages/Moyennes';
import Import from './pages/Import';
import OrgChart from './pages/OrgChart';
import AICenter from './pages/AICenter';
import Tickets from './pages/Tickets';
import Cantine from './pages/Cantine';
import AbsencesEnseignants from './pages/AbsencesEnseignants';
import RHCollaborateurs from './pages/RHCollaborateurs';
import RHConges from './pages/RHConges';
import RHTemps from './pages/RHTemps';
import RHPaie from './pages/RHPaie';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Administration": Administration,
    "Affectation": Affectation,
    "AffectationEleves": AffectationEleves,
    "Analytics": Analytics,
    "AppLogin": AppLogin,
    "Attendance": Attendance,
    "Bulletins": Bulletins,
    "Classes": Classes,
    "Dashboard": Dashboard,
    "EspaceParent": EspaceParent,
    "Events": Events,
    "Exams": Exams,
    "Finance": Finance,
    "Grades": Grades,
    "Homework": Homework,
    "Messages": Messages,
    "MobileSaisie": MobileSaisie,
    "Pilotage": Pilotage,
    "ProjectsScrum": ProjectsScrum,
    "Resources": Resources,
    "RoleSelect": RoleSelect,
    "Sanctions": Sanctions,
    "Schedule": Schedule,
    "SchoolYearManager": SchoolYearManager,
    "SocialNetwork": SocialNetwork,
    "Staff": Staff,
    "StudentDashboard": StudentDashboard,
    "StudentDashboard360": StudentDashboard360,
    "StudentDetail": StudentDetail,
    "Students": Students,
    "Subjects": Subjects,
    "Teachers": Teachers,
    "MonProfil": MonProfil,
    "PassageDeClasse": PassageDeClasse,
    "Rooms": Rooms,
    "Visio": Visio,
    "Moyennes": Moyennes,
    "Import": Import,
    "OrgChart": OrgChart,
    "AICenter": AICenter,
    "Tickets": Tickets,
    "Cantine": Cantine,
    "AbsencesEnseignants": AbsencesEnseignants,
    "RHCollaborateurs": RHCollaborateurs,
    "RHConges": RHConges,
    "RHTemps": RHTemps,
    "RHPaie": RHPaie,
}

export const pagesConfig = {
    mainPage: "Administration",
    Pages: PAGES,
    Layout: __Layout,
};