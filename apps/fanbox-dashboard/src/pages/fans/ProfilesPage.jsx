import { useEffect, useState } from "react";
import PageHeader from "../../components/PageHeader.jsx";
import DemographicsCharts from "../../components/DemographicsCharts.jsx";
import { fanboxApi } from "../../lib/api.js";

export default function ProfilesPage() {
  const [demographics, setDemographics] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fanboxApi
      .fanDemographics()
      .then((res) => setDemographics(res.data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page">
      <PageHeader
        module="Fans"
        title="Profile Demographics"
        description="Distribution of location, age, gender, household, and income segments."
      />
      <DemographicsCharts demographics={demographics} />
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
