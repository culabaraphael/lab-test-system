import { useEffect, useMemo, useState } from "react";
import DoctorSidebar from "../../components/doctor/DoctorSidebar";
import Header from "../../components/common/Header";

import { API_URL } from "../../config";

export default function DoctorAnalytics() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [period, setPeriod] = useState("30");
  const [testFilter, setTestFilter] = useState("ALL");
  const [classificationFilter, setClassificationFilter] =
    useState("ALL");

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/lab-results`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to retrieve laboratory analytics."
        );
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(
          "Unable to retrieve laboratory analytics."
        );
      }

      setResults(data.lab_results || []);
    } catch (err) {
      console.error(
        "Doctor analytics error:",
        err
      );

      setError(
        err.message ||
          "Unable to load laboratory analytics."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // DATE HELPERS
  // =========================================================

  const getResultDate = (result) => {
    return (
      result.submitted_at ||
      result.created_at ||
      result.updated_at ||
      null
    );
  };

  const getDateObject = (result) => {
    const value = getResultDate(result);

    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  };

  const getDaysAgo = (days) => {
    const date = new Date();

    date.setHours(0, 0, 0, 0);

    date.setDate(
      date.getDate() - (days - 1)
    );

    return date;
  };

  // =========================================================
  // TEST NAME
  // =========================================================

  const getTestName = (result) => {
    return (
      result.test_type?.name ||
      result.testType?.name ||
      result.test_name ||
      result.test_type_name ||
      "Unknown Test"
    );
  };

  // =========================================================
  // CLASSIFICATION
  //
  // This checks several possible locations because the exact
  // classification field depends on your backend structure.
  // =========================================================

  const getClassification = (result) => {
    // Classification is derived from the stored parameter flags
    // (HIGH, LOW, NORMAL, ABNORMAL, UNASSESSED) set by the system's
    // reference-range rules. UNASSESSED parameters are ignored.
    const flags = (result.parameters || [])
      .map((p) => String(p.flag || "").trim().toUpperCase())
      .filter((f) => f && f !== "UNASSESSED");

    if (flags.length === 0) {
      return "UNCLASSIFIED";
    }

    if (
      flags.some(
        (f) => f === "HIGH" || f === "LOW" || f === "ABNORMAL"
      )
    ) {
      return "ABNORMAL";
    }

    return "NORMAL";
  };

  // =========================================================
  // DATE FILTER
  // =========================================================

  const filteredResults = useMemo(() => {
    const cutoff = getDaysAgo(
      Number(period)
    );

    return results.filter((result) => {
      const date = getDateObject(result);

      if (!date) {
        return false;
      }

      if (date < cutoff) {
        return false;
      }

      if (
        testFilter !== "ALL" &&
        getTestName(result) !== testFilter
      ) {
        return false;
      }

      if (
        classificationFilter !== "ALL" &&
        getClassification(result) !==
          classificationFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    results,
    period,
    testFilter,
    classificationFilter,
  ]);

  // =========================================================
  // TEST TYPES
  // =========================================================

  const testTypes = useMemo(() => {
    const names = new Set();

    results.forEach((result) => {
      names.add(getTestName(result));
    });

    return Array.from(names).sort();
  }, [results]);

  // =========================================================
  // MAIN STATISTICS
  // =========================================================

  const statistics = useMemo(() => {
    let normal = 0;
    let abnormal = 0;
    let critical = 0;
    let unclassified = 0;

    filteredResults.forEach((result) => {
      const classification =
        getClassification(result);

      if (classification === "NORMAL") {
        normal++;
      } else if (
        classification === "ABNORMAL"
      ) {
        abnormal++;
      } else if (
        classification === "CRITICAL"
      ) {
        critical++;
      } else {
        unclassified++;
      }
    });

    const total =
      filteredResults.length;

    return {
      total,
      normal,
      abnormal,
      critical,
      unclassified,
      normalRate:
        total > 0
          ? (normal / total) * 100
          : 0,
      abnormalRate:
        total > 0
          ? (abnormal / total) * 100
          : 0,
      criticalRate:
        total > 0
          ? (critical / total) * 100
          : 0,
    };
  }, [filteredResults]);

  // =========================================================
  // TEST UTILIZATION
  // =========================================================

  const testUtilization = useMemo(() => {
    const counts = {};

    filteredResults.forEach((result) => {
      const name = getTestName(result);

      counts[name] =
        (counts[name] || 0) + 1;
    });

    const total =
      filteredResults.length;

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage:
          total > 0
            ? (count / total) * 100
            : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredResults]);

  // =========================================================
  // ABNORMALITY BY TEST TYPE
  // =========================================================

  const abnormalityByTest = useMemo(() => {
    const data = {};

    filteredResults.forEach((result) => {
      const name = getTestName(result);
      const classification =
        getClassification(result);

      if (!data[name]) {
        data[name] = {
          name,
          normal: 0,
          abnormal: 0,
          critical: 0,
          total: 0,
        };
      }

      data[name].total++;

      if (
        classification === "NORMAL"
      ) {
        data[name].normal++;
      }

      if (
        classification === "ABNORMAL"
      ) {
        data[name].abnormal++;
      }

      if (
        classification === "CRITICAL"
      ) {
        data[name].critical++;
      }
    });

    return Object.values(data)
      .map((item) => ({
        ...item,
        abnormalRate:
          item.total > 0
            ? ((item.abnormal +
                item.critical) /
                item.total) *
              100
            : 0,
      }))
      .sort(
        (a, b) =>
          b.abnormalRate -
          a.abnormalRate
      );
  }, [filteredResults]);

  // =========================================================
  // PARAMETER INSIGHTS
  //
  // Supports several common backend structures.
  // =========================================================

  const parameterInsights = useMemo(() => {
    const counts = {};

    filteredResults.forEach((result) => {
      const parameters =
        result.parameters ||
        result.result_parameters ||
        result.lab_result_parameters ||
        [];

      if (!Array.isArray(parameters)) {
        return;
      }

      parameters.forEach((parameter) => {
        const classification =
          String(
            parameter.classification ||
              parameter.result_classification ||
              parameter.status ||
              ""
          )
            .trim()
            .toUpperCase();

        const isAbnormal =
          classification.includes(
            "ABNORMAL"
          ) ||
          classification.includes(
            "HIGH"
          ) ||
          classification.includes(
            "LOW"
          ) ||
          classification.includes(
            "CRITICAL"
          );

        if (!isAbnormal) {
          return;
        }

        const name =
          parameter.parameter_name ||
          parameter.parameter?.name ||
          parameter.name ||
          parameter.test_parameter?.name ||
          "Unknown Parameter";

        counts[name] =
          (counts[name] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredResults]);

  // =========================================================
  // TREND DATA
  // =========================================================

  const trendData = useMemo(() => {
    const days = Number(period);

    const data = [];

    for (
      let i = days - 1;
      i >= 0;
      i--
    ) {
      const date = new Date();

      date.setHours(0, 0, 0, 0);

      date.setDate(
        date.getDate() - i
      );

      const normal = 0;
      const abnormal = 0;
      const critical = 0;

      const dayResults =
        filteredResults.filter(
          (result) => {
            const resultDate =
              getDateObject(result);

            if (!resultDate) {
              return false;
            }

            return (
              resultDate.getFullYear() ===
                date.getFullYear() &&
              resultDate.getMonth() ===
                date.getMonth() &&
              resultDate.getDate() ===
                date.getDate()
            );
          }
        );

      let normalCount = normal;
      let abnormalCount = abnormal;
      let criticalCount = critical;

      dayResults.forEach((result) => {
        const classification =
          getClassification(result);

        if (
          classification === "NORMAL"
        ) {
          normalCount++;
        }

        if (
          classification === "ABNORMAL"
        ) {
          abnormalCount++;
        }

        if (
          classification === "CRITICAL"
        ) {
          criticalCount++;
        }
      });

      data.push({
        date: date.toLocaleDateString(
          undefined,
          {
            month: "short",
            day: "numeric",
          }
        ),
        normal: normalCount,
        abnormal: abnormalCount,
        critical: criticalCount,
      });
    }

    return data;
  }, [
    filteredResults,
    period,
  ]);

  // =========================================================
  // PERIOD COMPARISON
  // =========================================================

  const periodComparison = useMemo(() => {
    const days = Number(period);

    const currentStart =
      getDaysAgo(days);

    const previousStart =
      new Date(currentStart);

    previousStart.setDate(
      previousStart.getDate() - days
    );

    const previousEnd =
      new Date(currentStart);

    previousEnd.setMilliseconds(
      -1
    );

    const previousResults =
      results.filter((result) => {
        const date =
          getDateObject(result);

        if (!date) {
          return false;
        }

        return (
          date >= previousStart &&
          date < previousEnd
        );
      });

    const currentTotal =
      filteredResults.length;

    const previousTotal =
      previousResults.length;

    const calculateChange = (
      current,
      previous
    ) => {
      if (previous === 0) {
        return current > 0
          ? 100
          : 0;
      }

      return (
        ((current - previous) /
          previous) *
        100
      );
    };

    const currentAbnormal =
      filteredResults.filter(
        (result) => {
          const classification =
            getClassification(result);

          return (
            classification ===
              "ABNORMAL"
          );
        }
      ).length;

    const previousAbnormal =
      previousResults.filter(
        (result) => {
          const classification =
            getClassification(result);

          return (
            classification ===
              "ABNORMAL"
          );
        }
      ).length;

    const currentPatients =
      getUniquePatients(
        filteredResults
      );

    const previousPatients =
      getUniquePatients(
        previousResults
      );

    return {
      total: {
        current: currentTotal,
        previous: previousTotal,
        change: calculateChange(
          currentTotal,
          previousTotal
        ),
      },

      abnormal: {
        current: currentAbnormal,
        previous: previousAbnormal,
        change: calculateChange(
          currentAbnormal,
          previousAbnormal
        ),
      },

      patients: {
        current: currentPatients,
        previous: previousPatients,
        change: calculateChange(
          currentPatients,
          previousPatients
        ),
      },
    };
  }, [
    results,
    filteredResults,
    period,
  ]);

  return (
    <div className="min-h-screen bg-gray-50">

      <DoctorSidebar />

      <main className="lg:ml-64 min-h-screen">

        <Header
          title="Laboratory Intelligence"
          user="DR"
        />

        <div className="pt-20 px-4 sm:px-6 lg:px-8 pb-10">

          {/* =================================================
              HEADER
          ================================================= */}

          <section className="mb-7">

            <p className="text-xs uppercase tracking-wider text-gray-500">
              Clinical Data Insights
            </p>

            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mt-2">
              Laboratory Intelligence
            </h1>

            <p className="text-sm text-gray-500 mt-2 max-w-2xl">
              Analyze laboratory testing patterns,
              result classifications, abnormality
              trends, and clinical data over time.
            </p>

          </section>

          {/* =================================================
              FILTERS
          ================================================= */}

          <section className="bg-white border border-gray-200 rounded-xl p-4 mb-6">

            <div className="flex flex-col lg:flex-row lg:items-end gap-4">

              <FilterSelect
                label="Analysis Period"
                value={period}
                onChange={setPeriod}
                options={[
                  {
                    value: "7",
                    label: "Last 7 Days",
                  },
                  {
                    value: "30",
                    label: "Last 30 Days",
                  },
                  {
                    value: "90",
                    label: "Last 90 Days",
                  },
                  {
                    value: "180",
                    label: "Last 6 Months",
                  },
                ]}
              />

              <FilterSelect
                label="Laboratory Test"
                value={testFilter}
                onChange={setTestFilter}
                options={[
                  {
                    value: "ALL",
                    label: "All Test Types",
                  },
                  ...testTypes.map(
                    (name) => ({
                      value: name,
                      label: name,
                    })
                  ),
                ]}
              />

              <FilterSelect
                label="Classification"
                value={
                  classificationFilter
                }
                onChange={
                  setClassificationFilter
                }
                options={[
                  {
                    value: "ALL",
                    label: "All Classifications",
                  },
                  {
                    value: "NORMAL",
                    label: "Normal",
                  },
                  {
                    value: "ABNORMAL",
                    label: "Abnormal",
                  },
                ]}
              />

              <button
                onClick={loadResults}
                className="h-10 px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Refresh
              </button>

            </div>

          </section>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {loading ? (

            <div className="bg-white border border-gray-200 rounded-xl min-h-[500px] flex items-center justify-center">

              <p className="text-sm text-gray-500">
                Loading laboratory intelligence...
              </p>

            </div>

          ) : (

            <>

              {/* =================================================
                  ANALYTICS METRICS
              ================================================= */}

              <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">

                <AnalyticsCard
                  label="Total Tests"
                  value={
                    statistics.total
                  }
                  description="Tests in selected period"
                />

                <AnalyticsCard
                  label="Normal Results"
                  value={
                    statistics.normal
                  }
                  description={`${statistics.normalRate.toFixed(
                    1
                  )}% of results`}
                />

                <AnalyticsCard
                  label="Abnormal Results"
                  value={
                    statistics.abnormal
                  }
                  description={`${statistics.abnormalRate.toFixed(
                    1
                  )}% of results`}
                />

              </section>

              {/* =================================================
                  TREND
              ================================================= */}

              <section className="bg-white border border-gray-200 rounded-xl mb-6">

                <div className="px-5 py-4 border-b border-gray-200">

                  <h2 className="text-sm font-semibold text-gray-900">
                    Result Classification Trend
                  </h2>

                  <p className="text-xs text-gray-500 mt-1">
                    Distribution of laboratory result
                    classifications throughout the selected period.
                  </p>

                </div>

                <div className="p-5">

                  <TrendChart
                    data={trendData}
                  />

                </div>

              </section>

              {/* =================================================
                  UTILIZATION + DISTRIBUTION
              ================================================= */}

              <section className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-6">

                <TestUtilization
                  data={testUtilization}
                />

                <ResultDistribution
                  statistics={statistics}
                />

              </section>

              {/* =================================================
                  ABNORMALITY BY TEST
              ================================================= */}

              <section className="bg-white border border-gray-200 rounded-xl mb-6">

                <div className="px-5 py-4 border-b border-gray-200">

                  <h2 className="text-sm font-semibold text-gray-900">
                    Abnormality by Test Type
                  </h2>

                  <p className="text-xs text-gray-500 mt-1">
                    Comparison of normal and abnormal
                    findings across laboratory tests.
                  </p>

                </div>

                <div className="overflow-x-auto">

                  <table className="w-full min-w-[700px]">

                    <thead className="bg-gray-50 border-b border-gray-200">

                      <tr>

                        <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">
                          Test Type
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">
                          Normal
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">
                          Abnormal
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">
                          Abnormal Rate
                        </th>

                      </tr>

                    </thead>

                    <tbody className="divide-y divide-gray-100">

                      {abnormalityByTest.length ===
                      0 ? (

                        <tr>

                          <td
                            colSpan="5"
                            className="px-5 py-12 text-center text-sm text-gray-500"
                          >
                            No classified laboratory
                            results available for this period.
                          </td>

                        </tr>

                      ) : (

                        abnormalityByTest.map(
                          (item) => (
                            <tr
                              key={
                                item.name
                              }
                              className="hover:bg-gray-50"
                            >

                              <td className="px-5 py-4">

                                <p className="text-sm font-medium text-gray-900">
                                  {item.name}
                                </p>

                                <p className="text-xs text-gray-400 mt-1">
                                  {item.total} total
                                  results
                                </p>

                              </td>

                              <td className="px-5 py-4 text-right text-sm text-gray-700">
                                {item.normal}
                              </td>

                              <td className="px-5 py-4 text-right text-sm text-gray-700">
                                {item.abnormal}
                              </td>

                              <td className="px-5 py-4 text-right">

                                <span
                                  className={
                                    "inline-flex px-2.5 py-1 rounded-full text-xs font-semibold " +
                                    getRateClass(
                                      item.abnormalRate
                                    )
                                  }
                                >
                                  {item.abnormalRate.toFixed(
                                    1
                                  )}
                                  %
                                </span>

                              </td>

                            </tr>
                          )
                        )

                      )}

                    </tbody>

                  </table>

                </div>

              </section>

              {/* =================================================
                  PARAMETER + PERIOD COMPARISON
              ================================================= */}

              <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                <ParameterInsights
                  data={
                    parameterInsights
                  }
                />

                <PeriodComparison
                  data={
                    periodComparison
                  }
                />

              </section>

              {/* =================================================
                  EMPTY / UNCLASSIFIED NOTICE
              ================================================= */}

              {statistics.unclassified >
                0 && (
                <section className="mt-6 bg-gray-100 border border-gray-200 rounded-xl p-5">

                  <p className="text-sm font-semibold text-gray-800">
                    Classification data notice
                  </p>

                  <p className="text-xs text-gray-600 mt-1 leading-5">
                    {
                      statistics.unclassified
                    }{" "}
                    result
                    {statistics.unclassified ===
                    1
                      ? ""
                      : "s"}{" "}
                    could not be assigned a
                    Normal or Abnormal
                    classification because all of their
                    parameters are UNASSESSED.
                  </p>

                </section>
              )}

            </>

          )}

        </div>

      </main>

    </div>
  );
}

// =============================================================
// ANALYTICS CARD
// =============================================================

function AnalyticsCard({
  label,
  value,
  description,
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">

      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </p>

      <p className="text-3xl font-semibold text-gray-900 mt-3">
        {value.toLocaleString()}
      </p>

      <p className="text-xs text-gray-500 mt-2">
        {description}
      </p>

    </div>
  );
}

// =============================================================
// FILTER SELECT
// =============================================================

function FilterSelect({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <div className="flex-1 min-w-[180px]">

      <label className="block text-xs font-medium text-gray-500 mb-1.5">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
      >

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}

      </select>

    </div>
  );
}

// =============================================================
// TREND CHART
// =============================================================

function TrendChart({ data }) {
  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-500">
        No trend data available.
      </div>
    );
  }

  const width = 900;
  const height = 300;

  const padding = {
    top: 20,
    right: 20,
    bottom: 45,
    left: 45,
  };

  const chartWidth =
    width -
    padding.left -
    padding.right;

  const chartHeight =
    height -
    padding.top -
    padding.bottom;

  const maxValue = Math.max(
    ...data.flatMap((item) => [
      item.normal,
      item.abnormal,
    ]),
    1
  );

  const getX = (index) => {
    if (data.length === 1) {
      return padding.left +
        chartWidth / 2;
    }

    return (
      padding.left +
      (index /
        (data.length - 1)) *
        chartWidth
    );
  };

  const getY = (value) => {
    return (
      padding.top +
      chartHeight -
      (value / maxValue) *
        chartHeight
    );
  };

  const createPoints = (key) => {
    return data
      .map(
        (item, index) =>
          `${getX(index)},${getY(
            item[key]
          )}`
      )
      .join(" ");
  };

  const gridLines = 4;

  return (
    <div className="w-full overflow-x-auto">

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[650px]"
        role="img"
        aria-label="Result classification trend"
      >

        {/* GRID */}

        {Array.from(
          { length: gridLines + 1 },
          (_, index) => {
            const value =
              Math.round(
                (maxValue /
                  gridLines) *
                  index
              );

            const y =
              getY(value);

            return (
              <g key={index}>

                <line
                  x1={padding.left}
                  x2={
                    width -
                    padding.right
                  }
                  y1={y}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />

                <text
                  x={
                    padding.left -
                    8
                  }
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#9ca3af"
                >
                  {value}
                </text>

              </g>
            );
          }
        )}

        {/* X LABELS */}

        {data.map(
          (item, index) => {

            const showLabel =
              data.length <= 10 ||
              index === 0 ||
              index ===
                Math.floor(
                  data.length / 2
                ) ||
              index ===
                data.length - 1;

            if (!showLabel) {
              return null;
            }

            return (
              <text
                key={index}
                x={getX(index)}
                y={
                  height -
                  18
                }
                textAnchor="middle"
                fontSize="10"
                fill="#9ca3af"
              >
                {item.date}
              </text>
            );
          }
        )}

        {/* NORMAL */}

        <polyline
          points={createPoints(
            "normal"
          )}
          fill="none"
          stroke="#111827"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* ABNORMAL */}

        <polyline
          points={createPoints(
            "abnormal"
          )}
          fill="none"
          stroke="#6b7280"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="6 4"
        />

      </svg>

      <div className="flex items-center justify-center gap-6 mt-2">

        <Legend
          label="Normal"
          className="bg-gray-900"
        />

        <Legend
          label="Abnormal"
          className="bg-gray-500"
        />

      </div>

    </div>
  );
}

// =============================================================
// LEGEND
// =============================================================

function Legend({
  label,
  className,
}) {
  return (
    <div className="flex items-center gap-2">

      <span
        className={
          "w-2.5 h-2.5 rounded-full " +
          className
        }
      />

      <span className="text-xs text-gray-500">
        {label}
      </span>

    </div>
  );
}

// =============================================================
// TEST UTILIZATION
// =============================================================

function TestUtilization({
  data,
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl">

      <div className="px-5 py-4 border-b border-gray-200">

        <h2 className="text-sm font-semibold text-gray-900">
          Test Utilization
        </h2>

        <p className="text-xs text-gray-500 mt-1">
          Most frequently performed laboratory
          examinations in the selected period.
        </p>

      </div>

      <div className="p-5">

        {data.length === 0 ? (

          <EmptyMessage text="No laboratory test data available." />

        ) : (

          <div className="space-y-4">

            {data
              .slice(0, 7)
              .map((item) => (

                <div key={item.name}>

                  <div className="flex items-center justify-between mb-1.5">

                    <span className="text-sm text-gray-700">
                      {item.name}
                    </span>

                    <span className="text-sm font-semibold text-gray-900">
                      {item.count}
                    </span>

                  </div>

                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">

                    <div
                      className="h-full bg-gray-900 rounded-full"
                      style={{
                        width: `${Math.min(
                          item.percentage,
                          100
                        )}%`,
                      }}
                    />

                  </div>

                  <div className="flex justify-end mt-1">

                    <span className="text-[11px] text-gray-400">
                      {item.percentage.toFixed(
                        1
                      )}
                      % of tests
                    </span>

                  </div>

                </div>

              ))}

          </div>

        )}

      </div>

    </section>
  );
}

// =============================================================
// RESULT DISTRIBUTION
// =============================================================

function ResultDistribution({
  statistics,
}) {
  const total =
    statistics.total;

  const normalWidth =
    total > 0
      ? (statistics.normal /
          total) *
        100
      : 0;

  const abnormalWidth =
    total > 0
      ? (statistics.abnormal /
          total) *
        100
      : 0;

  return (
    <section className="bg-white border border-gray-200 rounded-xl">

      <div className="px-5 py-4 border-b border-gray-200">

        <h2 className="text-sm font-semibold text-gray-900">
          Result Distribution
        </h2>

        <p className="text-xs text-gray-500 mt-1">
          Overall classification of results in
          the selected period.
        </p>

      </div>

      <div className="p-5">

        {total === 0 ? (

          <EmptyMessage text="No result classification data available." />

        ) : (

          <>

            <div className="h-5 w-full rounded-full overflow-hidden bg-gray-100 flex">

              <div
                className="bg-gray-900"
                style={{
                  width: `${normalWidth}%`,
                }}
              />

              <div
                className="bg-gray-500"
                style={{
                  width: `${abnormalWidth}%`,
                }}
              />

            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">

              <DistributionItem
                label="Normal"
                value={
                  statistics.normal
                }
                percentage={
                  statistics.normalRate
                }
                dot="bg-gray-900"
              />

              <DistributionItem
                label="Abnormal"
                value={
                  statistics.abnormal
                }
                percentage={
                  statistics.abnormalRate
                }
                dot="bg-gray-500"
              />

            </div>

          </>

        )}

      </div>

    </section>
  );
}

// =============================================================
// DISTRIBUTION ITEM
// =============================================================

function DistributionItem({
  label,
  value,
  percentage,
  dot,
}) {
  return (
    <div>

      <div className="flex items-center gap-2">

        <span
          className={
            "w-2.5 h-2.5 rounded-full " +
            dot
          }
        />

        <span className="text-xs text-gray-500">
          {label}
        </span>

      </div>

      <p className="text-2xl font-semibold text-gray-900 mt-2">
        {value}
      </p>

      <p className="text-[11px] text-gray-400 mt-1">
        {percentage.toFixed(1)}%
      </p>

    </div>
  );
}

// =============================================================
// PARAMETER INSIGHTS
// =============================================================

function ParameterInsights({
  data,
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl">

      <div className="px-5 py-4 border-b border-gray-200">

        <h2 className="text-sm font-semibold text-gray-900">
          Parameter Insights
        </h2>

        <p className="text-xs text-gray-500 mt-1">
          Laboratory parameters most frequently
          identified as abnormal.
        </p>

      </div>

      <div className="p-5">

        {data.length === 0 ? (

          <div className="py-8 text-center">

            <p className="text-sm text-gray-500">
              Parameter-level classification
              data is not available.
            </p>

            <p className="text-xs text-gray-400 mt-1">
              This section will populate when
              parameter classification data is
              returned by the API.
            </p>

          </div>

        ) : (

          <div className="space-y-4">

            {data.map((item) => {

              const max =
                data[0].count ||
                1;

              const width =
                (item.count /
                  max) *
                100;

              return (
                <div
                  key={item.name}
                >

                  <div className="flex items-center justify-between mb-1.5">

                    <span className="text-sm text-gray-700">
                      {item.name}
                    </span>

                    <span className="text-sm font-semibold text-gray-900">
                      {item.count}
                    </span>

                  </div>

                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">

                    <div
                      className="h-full bg-gray-700 rounded-full"
                      style={{
                        width: `${width}%`,
                      }}
                    />

                  </div>

                </div>
              );
            })}

          </div>

        )}

      </div>

    </section>
  );
}

// =============================================================
// PERIOD COMPARISON
// =============================================================

function PeriodComparison({
  data,
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl">

      <div className="px-5 py-4 border-b border-gray-200">

        <h2 className="text-sm font-semibold text-gray-900">
          Period Comparison
        </h2>

        <p className="text-xs text-gray-500 mt-1">
          Current selected period compared with
          the previous equivalent period.
        </p>

      </div>

      <div className="p-5 space-y-5">

        <ComparisonRow
          label="Total Tests"
          data={data.total}
        />

        <ComparisonRow
          label="Abnormal Results"
          data={data.abnormal}
        />

        <ComparisonRow
          label="Unique Patients"
          data={data.patients}
        />

      </div>

    </section>
  );
}

// =============================================================
// COMPARISON ROW
// =============================================================

function ComparisonRow({
  label,
  data,
}) {
  const positive =
    data.change >= 0;

  return (
    <div className="flex items-center justify-between">

      <div>

        <p className="text-sm font-medium text-gray-800">
          {label}
        </p>

        <p className="text-xs text-gray-400 mt-1">
          {data.current.toLocaleString()} current
          {" · "}
          {data.previous.toLocaleString()} previous
        </p>

      </div>

      <span
        className={
          "text-sm font-semibold " +
          (positive
            ? "text-gray-900"
            : "text-red-600")
        }
      >
        {positive ? "+" : ""}
        {data.change.toFixed(1)}%
      </span>

    </div>
  );
}

// =============================================================
// EMPTY MESSAGE
// =============================================================

function EmptyMessage({
  text,
}) {
  return (
    <div className="py-10 text-center">

      <p className="text-sm text-gray-500">
        {text}
      </p>

    </div>
  );
}

// =============================================================
// ABNORMAL RATE COLOR
// =============================================================

function getRateClass(rate) {
  if (rate >= 30) {
    return "bg-red-100 text-red-700";
  }

  if (rate >= 15) {
    return "bg-yellow-100 text-yellow-700";
  }

  return "bg-gray-100 text-gray-700";
}

// =============================================================
// UNIQUE PATIENTS
// =============================================================

function getUniquePatients(
  results
) {
  const patients = new Set();

  results.forEach((result) => {
    const patient =
      result.patient || {};

    const patientId =
      patient.id ||
      patient.patient_id ||
      result.patient_id;

    if (patientId) {
      patients.add(
        String(patientId)
      );
    }
  });

  return patients.size;
}