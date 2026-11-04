import MainLayout from "../layouts/MainLayout";

import DashboardStats from "../components/dashboard/DashboardStats";

import FarmOverview from "../components/dashboard/FarmOverview";

import ChartDashboard from "../components/charts/ChartDashboard";

import EventLog from "../components/dashboard/EventLog";
import FarmDrawer from "../components/farm/FarmDrawer";
import ProductHero from "../components/dashboard/ProductHero";

function Dashboard() {
  return (
    <MainLayout>

      <ProductHero />

      <div className="mt-8"><DashboardStats /></div>

      <FarmOverview />
        <ChartDashboard />  
        <EventLog />
        <FarmDrawer />
    </MainLayout>
  );
}

export default Dashboard;
