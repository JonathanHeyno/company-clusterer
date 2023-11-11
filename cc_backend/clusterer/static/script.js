let k_as_number = 0;
let dimensions_txts = ['dimension1', 'dimension2'];
let data_traces = [];
let companies = [];
let plt_config = {responsive: true};
let metrics = {};

let plt_layout = {
    xaxis: {
      range: []
    },
    yaxis: {
      range: []
    },
    legend: {
      y: 0.5,
      yref: 'paper',
      font: {
        family: 'Arial, sans-serif',
        size: 20,
        color: 'grey',
      }
    },
    title:'Company clustering',
    showlegend: false, 
    paper_bgcolor: 'rgba(0, 0, 0, 0)',
    plot_bgcolor: 'rgba(0, 0, 0, 0)'
};


document.addEventListener("DOMContentLoaded", function () {
    const navbarLinks = document.querySelectorAll('.navbar a');
    const contentContainer = document.getElementById('content');

    navbarLinks.forEach(link => {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            const target = this.getAttribute('data-target');
            navigateTo(target);
            history.pushState({ page: target }, null, `#${target}`);
        });
    });

    window.addEventListener('popstate', function (event) {
        const target = event.state ? event.state.page : 'main';
        navigateTo(target);
    });

    navigateTo('main');

    function navigateTo(target) {
        const content = getContent(target);
        contentContainer.innerHTML = content;
    }

    document.getElementById("xAxis").onchange=changeXaxis;
    document.getElementById("yAxis").onchange=changeYaxis;
});

function getContent(target) {
    switch (target) {
        case 'main':
            return getMainPage();
        case 'instructions':
            return getInstructionPage();
        default:
            return '<p>Page does not exist.</p>';
    }
}

function getMainPage() {
    function createDropdown(id) {
        const selectElement = document.createElement('select');
        selectElement.id = id;
        return selectElement.outerHTML;
    }

    return `
    <h1>Company Clusterer</h1>
        <div class="flex-container-column">
            <div>
                <label>Find company:</label>
                <input type="text" id="newCompany" placeholder="Optional">
                <button id="addCompany" onclick="retrieveCompany()">Find Company</button>
            </div>
            <div>
                <label>Dimensions:</label>
                <input type="text" id="dimensions" placeholder="Enter dimensions" size="40">
                <label>k:</label>
                <input type="text" id="k" placeholder="k" size="2">
                <button id="getDimensionData" onClick="CalculateKMeans()">Calculate K-Means</button>
            </div>
            <div id="error-status" class="hidden">
                <div id="error-container" class="error-container">Error</div>
            </div>
            <div id='divXaxis' class="hidden">
                <label>X-axis dimension:</label>
                ${createDropdown('xAxis')}
            </div>
            <div id='divYaxis' class="hidden">
                <label>Y-axis dimension:</label>
                ${createDropdown('yAxis')}
            </div>
        </div>
        <div id='scatterPlot'><!-- Plotly chart will be drawn inside this DIV --></div>
        <div id= "clusterData" class="hidden">
            <h2>Company clustering data</h2>
            <div>Silhouette score: <span id="silhouette_score"></span></div>
            <div>
                <ul id="info"><li><b>Company, cluster, dimension 1, dimension 2</b></li></ul>
                <ul id="KMeans"></ul>
            </div>
        </div>
    `;
}

function retrieveCompany() {
    const companySymbols = document.getElementById('newCompany').value;
    retrieveData(ticker=companySymbols);
}

function CalculateKMeans() {
    return retrieveData(ticker='');
}

function retrieveData(ticker='') {
    fetch("/get_company/", {
        method: "POST",
        body: new URLSearchParams({
            ticker: ticker,
            dimensions: document.getElementById("dimensions").value,
            k: document.getElementById("k").value
        }),
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(response.statusText);
        }
        return response.json();
    })
    .then((data) => {
        if (data.error) {
            console.error(data.error);
        } else {
            document.getElementById("error-status").classList.remove("visible");
            document.getElementById("error-status").classList.add("hidden");
            updateAllData(data)
        }
    })
    .catch(error => {
        const errorContainer = document.getElementById('error-container');
        errorContainer.innerHTML = error.message;
        document.getElementById("error-status").classList.remove("hidden");
        document.getElementById("error-status").classList.add("visible");
    });
}

function updateAllData(data) {
    const dimensionsInput = document.getElementById("dimensions");
    const xAxis = document.getElementById("xAxis");
    const yAxis = document.getElementById("yAxis");
    const silhouette_score = document.getElementById("silhouette_score");

    data.companies.sort(function (a, b) {
        return a.cluster - b.cluster || a.symbol.localeCompare(b.symbol);
    });
    companies = data.companies;
    metrics = data.metrics;
    silhouette_score.innerHTML = Number(metrics.silhouette_score).toFixed(6);

    k_as_number = Number(companies[companies.length - 1].cluster);

    dimensions_txts = dimensionsInput.value.split(",").map(function(item) {
        return item.trim();
    });

    xAxis.innerHTML = "";
    for (let i = 0; i < dimensions_txts.length; i++) {
        const opt = document.createElement("option");
        opt.value = i+1;
        opt.textContent = "dimension" + opt.value + ": " + dimensions_txts[i];
        xAxis.appendChild(opt);
    }
    yAxis.innerHTML = "";
    for (let i = 0; i < dimensions_txts.length; i++) {
        const opt = document.createElement("option");
        opt.value = i+1;
        opt.textContent = "dimension" + opt.value + ": " + dimensions_txts[i];
        yAxis.appendChild(opt);
    }

    if (dimensions_txts.length > 1) {
        xAxis.selectedIndex = 0;
        yAxis.selectedIndex = 1;
    }

    updateCompanyList()

    // Unhide axes and clustering data lists
    let divXaxis = document.getElementById("divXaxis");
    divXaxis.classList.remove("hidden");
    divXaxis.classList.add("visible");
    let divYaxis = document.getElementById("divYaxis");
    divYaxis.classList.remove("hidden");
    divYaxis.classList.add("visible");
    const cluster_data_div = document.getElementById("clusterData");
    cluster_data_div.classList.remove("hidden");
    cluster_data_div.classList.add("cluster-data-visible");

    initialize_data_traces();
    renderGraph();
}

function updateCompanyList() {
    const KMeansList = document.getElementById("KMeans");
    KMeansList.innerHTML = "";
    companies.forEach(function (companyData) {
        const li = document.createElement("li");
        li.textContent =   `${companyData.symbol},
                            ${Number(companyData.cluster) + 1},
                            ${Math.round(Number(companyData['dimension'+xAxis.value]).toFixed(6)*1000000)/1000000},
                            ${Math.round(Number(companyData['dimension'+yAxis.value]).toFixed(6)*1000000)/1000000}`;
        KMeansList.appendChild(li);
    });
}

function initialize_data_traces() {
    data_traces = new Array(k_as_number);
    for (let i = 0; i <= k_as_number; i++) {
        data_traces[i] = {
            x: [],
            y: [],
            mode: 'markers+text',
            type: 'scatter',
            name: `Cluster ${i+1}`,
            text: [],
            textposition: 'top center',
            textfont: {
              family:  'Raleway, sans-serif'
            },
            marker: { size: 12 }
          };
    };

    for (let i = 0; i < companies.length; i++) {
        data_traces[Number(companies[i].cluster)].x.push(companies[i]['dimension'+xAxis.value]);
        data_traces[Number(companies[i].cluster)].y.push(companies[i]['dimension'+yAxis.value]);
        data_traces[Number(companies[i].cluster)].text.push(companies[i]['symbol']);
    };

    plt_layout.xaxis.range = getRange(dimension='dimension'+xAxis.value, padding=0.1);
    plt_layout.yaxis.range = getRange(dimension='dimension'+yAxis.value, padding=0.1);
}

function getRange(dimension, padding=0.1) {
    if (companies.length === 0) {
        return [0, 0]
    };
    max = companies[0][dimension];
    min = companies[0][dimension];
    for (let i = 0; i < companies.length; i++) {
        if (companies[i][dimension] > max) {
            max = companies[i][dimension];
        }
        if (companies[i][dimension] < min) {
            min= companies[i][dimension];
        }
    }
    extra = (max-min)*padding;
    return [min-extra, max+extra];
}

function renderGraph() {
    Plotly.newPlot('scatterPlot', data_traces, plt_layout, plt_config);
  }
    
function changeXaxis() {
    const xAxis = document.getElementById("xAxis");
    for (let i = 0; i <= k_as_number; i++) {
        data_traces[i].x = [];
    }
    for (let i = 0; i < companies.length; i++) {
        data_traces[Number(companies[i].cluster)].x.push(companies[i]['dimension'+xAxis.value]);
    }
    plt_layout.xaxis.range = getRange(dimension='dimension'+xAxis.value, padding=0.1);
    renderGraph();
    updateCompanyList();
}

function changeYaxis() {
    const yAxis = document.getElementById("yAxis");
    for (let i = 0; i <= k_as_number; i++) {
        data_traces[i].y = [];
    }
    for (let i = 0; i < companies.length; i++) {
        data_traces[Number(companies[i].cluster)].y.push(companies[i]['dimension'+yAxis.value]);
    }
    plt_layout.yaxis.range = getRange(dimension='dimension'+yAxis.value, padding=0.1);
    renderGraph();
    updateCompanyList();
}

function getInstructionPage() {
    return `
    <h1>Company Clusterer</h1>
    <p>To use the app, you need to enter the dimensions based on which the
        clustering will be done. You can add as many dimensions as you want
        separated by a comma and form them as an expression using '+-*/^()'
        based on fields available on the companies' balance sheets and income
        statements. The field names used in the dimensions must be entered
        exactly as they are below and are case sensitive. This is useful
        because comparing e.g. the profits of a small company to a large
        company may be useless, but not comparing their profitability as a
        percentage. Here is an example for entering three dimensions:
    </p>
    <p>
        grossProfit / totalRevenue, currentDebt / grossProfit,
        researchAndDevelopment / sellingGeneralAndAdministrative
    </p>
    <p>
        You can additionally set k, the number of clusters you want. If you
        do not set k, an optimal value for k will be determined based on the
        silhouette method.
    </p>
    <p>
        If a company you are interested in is not present in the analysis,
        you can enter its ticker symbol (e.g. MCD for Mc Donald's) into the
        find company field. The app will try to retrieve the company. If the
        company does not get added to the analysis, it was either not found
        with the given ticker, or it does not have all the required data to
        form the dimensions you wrote. E.g. if the company does not have any
        current long term debt, and you used that in the dimensions, the
        company will be dropped from the clustering. You can add several
        companies at a time, like this: MCD, AAPL, GOOG.
    </p>
    <p>
        After clicking on either the 'Find Company' or 'Calculate K-Means'
        button, the app will display the clustering, the silhouette score,
        and give a listing of all the companies and their clustering data.
        You can examine different cross sections by selecting which
        dimensions to display on the x and y axes. This listing of the
        companies' clustering data will also change to show the data for
        these dimensions.
    </p>
    <p>The following fields can be used to create dimensions:</p>
    <ul class="list">
        <li>accumulatedDepreciationAmortizationPPE</li>
        <li>capitalLeaseObligations</li>
        <li>cashAndCashEquivalentsAtCarryingValue</li>
        <li>cashAndShortTermInvestments</li>
        <li>commonStock</li>
        <li>commonStockSharesOutstanding</li>
        <li>comprehensiveIncomeNetOfTax</li>
        <li>costofGoodsAndServicesSold</li>
        <li>costOfRevenue</li>
        <li>currentAccountsPayable</li>
        <li>currentDebt</li>
        <li>currentLongTermDebt</li>
        <li>currentNetReceivables</li>
        <li>deferredRevenue</li>
        <li>depreciation</li>
        <li>depreciationAndAmortization</li>
        <li>ebit</li>
        <li>ebitda</li>
        <li>fiscalDateEnding</li>
        <li>goodwill</li>
        <li>grossProfit</li>
        <li>incomeBeforeTax</li>
        <li>incomeTaxExpense</li>
        <li>intangibleAssets</li>
        <li>intangibleAssetsExcludingGoodwill</li>
        <li>interestAndDebtExpense</li>
        <li>interestExpense</li>
        <li>interestIncome</li>
        <li>inventory</li>
        <li>investmentIncomeNet</li>
        <li>investments</li>
        <li>longTermDebt</li>
        <li>longTermDebtNoncurrent</li>
        <li>longTermInvestments</li>
        <li>netIncome</li>
        <li>netIncomeFromContinuingOperations</li>
        <li>netInterestIncome</li>
        <li>nonInterestIncome</li>
        <li>operatingExpenses</li>
        <li>operatingIncome</li>
        <li>otherCurrentAssets</li>
        <li>otherCurrentLiabilities</li>
        <li>otherNonCurrentAssets</li>
        <li>otherNonCurrentLiabilities</li>
        <li>otherNonOperatingIncome</li>
        <li>propertyPlantEquipment</li>
        <li>reportedCurrency</li>
        <li>researchAndDevelopment</li>
        <li>retainedEarnings</li>
        <li>sellingGeneralAndAdministrative</li>
        <li>shortLongTermDebtTotal</li>
        <li>shortTermDebt</li>
        <li>shortTermInvestments</li>
        <li>totalAssets</li>
        <li>totalCurrentAssets</li>
        <li>totalCurrentLiabilities</li>
        <li>totalLiabilities</li>
        <li>totalNonCurrentAssets</li>
        <li>totalNonCurrentLiabilities</li>
        <li>totalRevenue</li>
        <li>totalShareholderEquity</li>
        <li>treasuryStock</li>
    </ul>
    `;
}
