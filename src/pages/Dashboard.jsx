import MainLayout from "../layouts/MainLayout";

import DashboardStats from "../components/dashboard/DashboardStats";

import FarmOverview from "../components/dashboard/FarmOverview";
import { useFarm } from "../context/FarmContext";

import ChartDashboard from "../components/charts/ChartDashboard";

import EventLog from "../components/dashboard/EventLog";
import FarmDrawer from "../components/farm/FarmDrawer";

function Dashboard() {
  const { farms } = useFarm();

  return (
    <MainLayout>

      <DashboardStats />

      <FarmOverview />
        <ChartDashboard />  
        <EventLog />
        <FarmDrawer />
    </MainLayout>
  );
}

export default Dashboard;