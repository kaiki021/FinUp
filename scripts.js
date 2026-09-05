/* =====================================================
   FINUP — JAVASCRIPT
===================================================== */

"use strict";


/* =====================================================
   CONFIGURAÇÃO
===================================================== */

const DATA_KEY = "finup_data";

const categories = {

    "Alimentação": {
        icon: "🍔"
    },

    "Transporte": {
        icon: "🚗"
    },

    "Moradia": {
        icon: "🏠"
    },

    "Lazer": {
        icon: "🎮"
    },

    "Saúde": {
        icon: "❤️"
    },

    "Educação": {
        icon: "📚"
    },

    "Compras": {
        icon: "🛍️"
    },

    "Outros": {
        icon: "📦"
    }

};


const defaultState = {

    expenses: [],

    extraIncome: [],

    limit: 0,

    income: {
        dailyRate: 0,
        daysPerWeek: 0,
        extraWorkDays: 0,
        absences: 0
    },

    goal: null,
    goals: [],

    viewDate:
        new Date().toISOString().slice(0, 10)

};


let state = {
    ...defaultState
};

let currentUser = null;

let expenseChart = null;
let currentGoalId = null;


/* =====================================================
   ELEMENTOS
===================================================== */

const $ = (id) =>
    document.getElementById(id);


/* =====================================================
   UTILITÁRIOS
===================================================== */

function formatBRL(value) {

    return new Intl.NumberFormat(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL"
        }
    ).format(Number(value) || 0);

}


function formatDate(dateString) {

    if (!dateString) {
        return "-";
    }

    const date = new Date(
        dateString + "T12:00:00"
    );

    return date.toLocaleDateString(
        "pt-BR"
    );

}


function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function generateId() {

    return Date.now().toString(36)
        + Math.random()
            .toString(36)
            .substring(2);

}


function getMonthKey(date) {

    return date.toISOString()
        .slice(0, 7);

}


function getCurrentMonthKey() {

    return state.viewDate.slice(0, 7);

}


function getPreviousMonthKey() {

    const date = new Date(
        state.viewDate + "T12:00:00"
    );

    date.setMonth(
        date.getMonth() - 1
    );

    return getMonthKey(date);

}


function getDaysInMonth(monthKey) {

    const [
        year,
        month
    ] = monthKey.split("-").map(Number);

    return new Date(
        year,
        month,
        0
    ).getDate();

}


function getMonthExpenses(monthKey) {

    return state.expenses.filter(
        expense =>
            expense.date &&
            expense.date.startsWith(monthKey)
    );

}


function totalExpenses(expenses) {

    return expenses.reduce(
        (total, expense) =>
            total + Number(expense.amount || 0),
        0
    );

}


function formatMonth(monthKey) {

    const date = new Date(
        monthKey + "-01T12:00:00"
    );

    return date.toLocaleDateString(
        "pt-BR",
        {
            month: "long",
            year: "numeric"
        }
    );


}


/* =====================================================
   PUTER — DADOS
===================================================== */

async function loadUserData() {

    try {

        if (
            !window.puter ||
            !puter.kv
        ) {

            throw new Error(
                "Puter KV não está disponível."
            );

        }


        const saved =
            await puter.kv.get(DATA_KEY);


        if (saved) {

            try {

                const parsed =
                    typeof saved === "string"
                        ? JSON.parse(saved)
                        : saved;

                state = {
                    ...defaultState,
                    ...parsed
                };

            } catch (error) {

                console.warn(
                    "Dados salvos inválidos.",
                    error
                );

                state = {
                    ...defaultState
                };

            }

        } else {

            state = {
                ...defaultState
            };

        }

        state.income = {
            ...defaultState.income,
            ...(state.income || {})
        };

        state.extraIncome = Array.isArray(state.extraIncome) ? state.extraIncome : [];

        if (!Array.isArray(state.expenses)) {

            state.expenses = [];

        }

        // Migra a meta antiga para a nova estrutura de múltiplas metas.
        if (!Array.isArray(state.goals)) state.goals = [];
        if (state.goal && !state.goals.some(g => g.id === state.goal.id)) {
            state.goals.unshift({
                ...state.goal,
                id: state.goal.id || `goal_${Date.now()}`
            });
        }
        if (state.goals.length) {
            state.goal = state.goals.find(g => g.id === state.goal?.id) || state.goals[0];
        } else {
            state.goal = null;
        }


        updateUserInterface();

        render();


    } catch (error) {

        console.error(error);

        showToast(
            "Não foi possível carregar seus dados.",
            "error"
        );

    }

}


async function saveUserData() {

    try {

        await puter.kv.set(
            DATA_KEY,
            JSON.stringify(state)
        );

        return true;

    } catch (error) {

        console.error(
            "Erro ao salvar dados:",
            error
        );

        showToast(
            "Erro ao salvar seus dados.",
            "error"
        );

        return false;

    }

}


/* =====================================================
   AUTENTICAÇÃO
===================================================== */

async function boot() {

    try {

        if (
            window.puter &&
            puter.auth &&
            puter.auth.isSignedIn()
        ) {

            await bootSignedUser();

        } else {

            showAuth();

        }

    } catch (error) {

        console.error(error);

        showAuth();

    }

}


async function bootSignedUser() {

    try {

        currentUser =
            await puter.auth.getUser();


        $("authScreen")
            .classList.add("hidden");

        $("app")
            .classList.remove("hidden");


        await loadUserData();


    } catch (error) {

        console.error(error);

        showAuth();

    }

}


function showAuth() {

    $("authScreen")
        .classList.remove("hidden");

    $("app")
        .classList.add("hidden");

}


async function login() {

    try {

        if (
            !window.puter ||
            !puter.auth
        ) {

            showToast(
                "Puter não foi carregado.",
                "error"
            );

            return;

        }


        if (
            puter.auth.isSignedIn()
        ) {

            await bootSignedUser();

            return;

        }


        /*
         * IMPORTANTE:
         * signIn() é chamado diretamente
         * pela ação do usuário.
         */

        await puter.auth.signIn();


        await bootSignedUser();


    } catch (error) {

        console.error(error);

        showToast(
            "Não foi possível entrar na conta.",
            "error"
        );

    }

}


async function logout() {

    try {

        await puter.auth.signOut();

        currentUser = null;

        state = {
            ...defaultState
        };

        showAuth();


    } catch (error) {

        console.error(error);

        showToast(
            "Erro ao sair.",
            "error"
        );

    }

}


/* =====================================================
   USUÁRIO
===================================================== */

function updateUserInterface() {

    if (!currentUser) {
        return;
    }


    const name =
        currentUser.username ||
        currentUser.name ||
        currentUser.email ||
        "Usuário";


    const email =
        currentUser.email ||
        "Conta Puter";


    $("userName").textContent =
        name;


    $("userEmail").textContent =
        email;


    $("userAvatar").textContent =
        name
            .charAt(0)
            .toUpperCase();


    const hour =
        new Date().getHours();


    let greeting =
        "Boa noite";


    if (hour < 12) {

        greeting =
            "Bom dia";

    } else if (hour < 18) {

        greeting =
            "Boa tarde";

    }


    $("pageGreeting").textContent =
        greeting;

}


/* =====================================================
   NAVEGAÇÃO
===================================================== */

function switchView(viewName) {

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.view === viewName
            );

        });


    document
        .querySelectorAll(".view")
        .forEach(view => {

            view.classList.remove(
                "active-view"
            );

        });


    const target =
        $(`${viewName}View`);


    if (target) {

        target.classList.add(
            "active-view"
        );

    }


    const titles = {

        dashboard:
            "Dashboard",

        expenses:
            "Despesas",

        goals:
            "Metas",

        income:
            "Minha Renda"

    };


    $("pageTitle").textContent =
        titles[viewName] || "Dashboard";

}


/* =====================================================
   RENDER PRINCIPAL
===================================================== */

function render() {

    renderMonth();

    renderDashboard();

    renderIncome();
    renderExtraIncome();

    renderCategories();

    renderChart();

    renderInsights();

    renderRecentExpenses();

    renderExpenseTable();

    renderGoal();

}


/* =====================================================
   MÊS
===================================================== */

function renderMonth() {

    const monthKey =
        getCurrentMonthKey();


    $("currentMonth")
        .textContent =
        formatMonth(monthKey);


    $("currentMonth").style.textTransform =
        "capitalize";

}


/* =====================================================
   DASHBOARD
===================================================== */

function renderDashboard() {

    const currentMonth =
        getCurrentMonthKey();


    const previousMonth =
        getPreviousMonthKey();


    const expenses =
        getMonthExpenses(currentMonth);


    const previousExpenses =
        getMonthExpenses(previousMonth);


    const total =
        totalExpenses(expenses);


    const previousTotal =
        totalExpenses(previousExpenses);


    $("totalSpent").textContent =
        formatBRL(total);


    $("purchaseCount").textContent =
        expenses.length;


    $("chartTotal").textContent =
        formatBRL(total);


    /*
     * Maior despesa
     */

    const largest =
        expenses.length
            ? [...expenses].sort(
                (a, b) =>
                    Number(b.amount) -
                    Number(a.amount)
            )[0]
            : null;


    $("largestExpense").textContent =
        largest
            ? formatBRL(largest.amount)
            : formatBRL(0);


    $("largestName").textContent =
        largest
            ? largest.description
            : "Nenhuma despesa";


    /*
     * Comparação
     */

    renderComparison(
        total,
        previousTotal
    );


    /*
     * Limite
     */

    renderLimit(total);


    /*
     * Valor disponível
     */

    const monthlyIncome = calculateMonthlyIncome();
    const available = Math.max(monthlyIncome - total, 0);


    $("savedAmount").textContent =
        formatBRL(available);


    $("goalMiniText").textContent =
        monthlyIncome > 0
            ? "restante da renda mensal"
            : "Configure sua renda";

}


/* =====================================================
   RENDA POR DIÁRIA
===================================================== */

function calculateMonthlyIncome() {

    const dailyRate = Number(state.income?.dailyRate || 0);
    const daysPerWeek = Number(state.income?.daysPerWeek || 0);
    const extraWorkDays = Number(state.income?.extraWorkDays || 0);
    const absences = Number(state.income?.absences || 0);

    // Média de 52 semanas por ano / 12 meses = 4,333 semanas por mês.
    const baseIncome = dailyRate * daysPerWeek * (52 / 12);
    const extraIncome = dailyRate * extraWorkDays;
    const absenceLoss = dailyRate * absences;
    const extraIncomeOutsideWork = getMonthExtraIncome().reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return Math.max(0, baseIncome + extraIncome - absenceLoss + extraIncomeOutsideWork);
}


function renderIncome() {

    const dailyRateInput = $("dailyRateInput");
    const daysPerWeekInput = $("daysPerWeekInput");
    const extraInput = $("extraWorkDaysInput");
    const absencesInput = $("absencesInput");
    const monthlyIncome = $("monthlyIncomeValue");
    const incomeSpent = $("incomeSpentValue");
    const incomeBalance = $("incomeBalanceValue");
    const incomePercent = $("incomePercentValue");
    const calculationText = $("incomeCalculationText");

    if (!dailyRateInput || !daysPerWeekInput || !monthlyIncome) return;

    const dailyRate = Number(state.income?.dailyRate || 0);
    const daysPerWeek = Number(state.income?.daysPerWeek || 0);
    const extraWorkDays = Number(state.income?.extraWorkDays || 0);
    const absences = Number(state.income?.absences || 0);
    const monthly = calculateMonthlyIncome();
    const total = totalExpenses(getMonthExpenses(getCurrentMonthKey()));
    const balance = monthly - total;
    const percent = monthly > 0 ? (total / monthly) * 100 : 0;

    dailyRateInput.value = dailyRate || "";
    daysPerWeekInput.value = daysPerWeek || "";
    if (extraInput) extraInput.value = extraWorkDays;
    if (absencesInput) absencesInput.value = absences;
    monthlyIncome.textContent = formatBRL(monthly);
    if (incomeSpent) incomeSpent.textContent = formatBRL(total);
    if (incomeBalance) incomeBalance.textContent = formatBRL(balance);
    if (incomePercent) incomePercent.textContent = monthly > 0 ? `${Math.round(percent)}%` : "0%";

    if (calculationText) {
        if (dailyRate > 0 && daysPerWeek > 0) {
            const base = dailyRate * daysPerWeek * (52 / 12);
            const extras = dailyRate * extraWorkDays;
            const losses = dailyRate * absences;
            calculationText.innerHTML = `Base: <strong>${formatBRL(base)}</strong> + dias de trabalho extra: <strong>${formatBRL(extras)}</strong> − faltas: <strong>${formatBRL(losses)}</strong> = <strong>${formatBRL(monthly)}</strong>.`;
        } else {
            calculationText.textContent = "Informe sua diária e os dias trabalhados por semana.";
        }
    }
}


async function saveIncome(event) {

    event.preventDefault();

    const dailyRate = Number($("dailyRateInput")?.value || 0);
    const daysPerWeek = Number($("daysPerWeekInput")?.value || 0);
    const extraWorkDays = Number($("extraWorkDaysInput")?.value || 0);
    const absences = Number($("absencesInput")?.value || 0);

    if (dailyRate <= 0 || daysPerWeek < 1 || daysPerWeek > 7 || extraWorkDays < 0 || absences < 0) {
        showToast("Informe uma diária válida e de 1 a 7 dias por semana.", "error");
        return;
    }

    state.income = {
        dailyRate,
        daysPerWeek,
        extraWorkDays: Math.floor(extraWorkDays),
        absences: Math.floor(absences)
    };

    const saved = await saveUserData();

    if (saved) {
        renderIncome();
        showToast("Renda por diária salva com sucesso.", "success");
    }
}


/* =====================================================
   RENDA EXTRA
===================================================== */

function getMonthExtraIncome(monthKey = getCurrentMonthKey()) {
    return (state.extraIncome || []).filter(item => String(item.date || "").slice(0, 7) === monthKey);
}

function renderExtraIncome() {
    const list = $("extraIncomeList");
    if (!list) return;

    const items = getMonthExtraIncome();
    if (!items.length) {
        list.innerHTML = '<div class="empty-state">Nenhuma renda extra registrada neste mês.</div>';
        return;
    }

    list.innerHTML = items.slice().reverse().map(item => `
        <div class="extra-income-item">
            <div>
                <strong>${escapeHTML(item.description || "Renda extra")}</strong>
                <small>${formatDate(item.date)}</small>
            </div>
            <div class="extra-income-item-value">
                <strong>+ ${formatBRL(item.amount)}</strong>
                <button type="button" class="icon-button" data-delete-extra-income="${item.id}" title="Excluir">🗑️</button>
            </div>
        </div>`).join("");

    list.querySelectorAll("[data-delete-extra-income]").forEach(button => {
        button.addEventListener("click", async () => {
            state.extraIncome = (state.extraIncome || []).filter(item => String(item.id) !== String(button.dataset.deleteExtraIncome));
            await saveUserData();
            render();
            showToast("Renda extra excluída.", "success");
        });
    });
}

async function addExtraIncome(event) {
    event.preventDefault();
    const description = String($("extraIncomeDescriptionInput")?.value || "").trim();
    const amount = Number($("extraIncomeAmountInput")?.value || 0);
    const date = $("extraIncomeDateInput")?.value || new Date().toISOString().slice(0, 10);

    if (amount <= 0) {
        showToast("Informe um valor válido para a renda extra.", "error");
        return;
    }

    if (!state.extraIncome) state.extraIncome = [];
    state.extraIncome.push({
        id: Date.now(),
        description: description || "Renda extra",
        amount,
        date,
        createdAt: new Date().toISOString()
    });

    if (await saveUserData()) {
        $("extraIncomeDescriptionInput").value = "";
        $("extraIncomeAmountInput").value = "";
        $("extraIncomeDateInput").value = new Date().toISOString().slice(0, 10);
        render();
        showToast("Renda extra adicionada.", "success");
    }
}

/* =====================================================
   COMPARAÇÃO
===================================================== */

function renderComparison(
    current,
    previous
) {

    const element =
        $("monthComparison");


    if (previous === 0 && current === 0) {

        element.textContent =
            "Nenhum gasto registrado";

        return;

    }


    if (previous === 0) {

        element.textContent =
            "Sem histórico do mês anterior";

        return;

    }


    const percent =
        ((current - previous) /
            previous) * 100;


    if (percent > 0) {

        element.innerHTML =
            `↑ ${Math.abs(percent).toFixed(1)}% ` +
            `a mais que o mês anterior`;

        element.style.color =
            "var(--red)";

    } else if (percent < 0) {

        element.innerHTML =
            `↓ ${Math.abs(percent).toFixed(1)}% ` +
            `a menos que o mês anterior`;

        element.style.color =
            "var(--green)";

    } else {

        element.textContent =
            "Mesmo valor do mês anterior";

        element.style.color =
            "var(--muted)";

    }

}


/* =====================================================
   LIMITE
===================================================== */

function renderLimit(total) {

    // No Dashboard, o antigo card "Limite mensal" agora acompanha
    // automaticamente a renda mensal estimada cadastrada em Minha Renda.
    const monthlyIncome = calculateMonthlyIncome();

    $("limitValue").textContent =
        formatBRL(monthlyIncome);

    const progress =
        monthlyIncome > 0
            ? (total / monthlyIncome) * 100
            : 0;

    const visibleProgress =
        Math.min(
            Math.max(progress, 0),
            100
        );

    const progressElement =
        $("limitProgress");

    progressElement.style.width =
        `${visibleProgress}%`;

    progressElement.classList.remove(
        "warning",
        "danger"
    );

    if (progress >= 100) {
        progressElement.classList.add("danger");
    } else if (progress >= 80) {
        progressElement.classList.add("warning");
    }

    $("limitPercent").textContent =
        `${Math.round(progress)}%`;

    const status =
        $("limitStatus");

    if (monthlyIncome === 0) {
        status.textContent =
            "Informe sua diária e os dias trabalhados em Minha Renda.";
    } else if (progress < 50) {
        status.textContent =
            `Você gastou ${formatBRL(total)} de uma renda estimada de ${formatBRL(monthlyIncome)}.`;
    } else if (progress < 80) {
        status.textContent =
            "Você já comprometeu mais de 50% da sua renda mensal.";
    } else if (progress < 100) {
        status.textContent =
            "Atenção: você já comprometeu mais de 80% da sua renda.";
    } else {
        status.textContent =
            `Seus gastos ultrapassaram sua renda estimada em ${formatBRL(total - monthlyIncome)}.`;
    }

    const alert =
        $("alertBox");

    alert.classList.add("hidden");
    alert.classList.remove("danger");

    if (monthlyIncome > 0 && progress >= 100) {
        alert.classList.remove("hidden");
        alert.classList.add("danger");
        $("alertTitle").textContent =
            "Gastos acima da renda";
        $("alertMessage").textContent =
            `Seus gastos ultrapassaram sua renda mensal estimada em ${formatBRL(total - monthlyIncome)}.`;
    } else if (monthlyIncome > 0 && progress >= 80) {
        alert.classList.remove("hidden");
        $("alertTitle").textContent =
            "Atenção à sua renda";
        $("alertMessage").textContent =
            `Você já utilizou ${Math.round(progress)}% da sua renda mensal estimada.`;
    } else if (monthlyIncome > 0 && progress >= 50) {
        alert.classList.remove("hidden");
        $("alertTitle").textContent =
            "Você atingiu 50% da renda";
        $("alertMessage").textContent =
            "Vale a pena acompanhar os próximos gastos.";
    }

}



/* =====================================================
   GRÁFICO
===================================================== */

function renderChart() {

    const monthKey =
        getCurrentMonthKey();

    const expenses =
        getMonthExpenses(monthKey);

    const days =
        getDaysInMonth(monthKey);

    const labels =
        Array.from(
            { length: days },
            (_, index) => String(index + 1)
        );

    const values =
        Array.from(
            { length: days },
            (_, index) => {

                const day =
                    String(index + 1).padStart(2, "0");

                const date = `${monthKey}-${day}`;

                return expenses
                    .filter(expense => expense.date === date)
                    .reduce(
                        (sum, expense) =>
                            sum + Number(expense.amount || 0),
                        0
                    );
            }
        );

    const canvas = $("expenseChart");
    const empty = $("chartEmpty");

    if (!expenses.length) {
        canvas.style.display = "none";
        empty.classList.remove("hidden");
    } else {
        canvas.style.display = "block";
        empty.classList.add("hidden");
    }

    if (expenseChart) {
        expenseChart.destroy();
    }

    const context = canvas.getContext("2d");

    /* Gradiente suave para deixar o gráfico mais moderno sem alterar os dados. */
    const gradient = context.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, "rgba(108, 99, 255, 0.24)");
    gradient.addColorStop(1, "rgba(108, 99, 255, 0.015)");

    expenseChart = new Chart(context, {

        type: "line",

        data: {
            labels,
            datasets: [
                {
                    label: "Gastos",
                    data: values,

                    borderColor: "#6c63ff",
                    backgroundColor: gradient,
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.38,

                    /* Mostra os pontos apenas quando o usuário interage. */
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBorderWidth: 2,
                    pointHoverBackgroundColor: "#ffffff",
                    pointHoverBorderColor: "#6c63ff",

                    spanGaps: true
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            animation: {
                duration: 700,
                easing: "easeOutQuart"
            },

            interaction: {
                intersect: false,
                mode: "index"
            },

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    displayColors: false,
                    backgroundColor: "rgba(20, 22, 38, 0.94)",
                    titleColor: "#ffffff",
                    bodyColor: "#ffffff",
                    borderColor: "rgba(108, 99, 255, 0.45)",
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 10,
                    callbacks: {
                        title: function (items) {
                            if (!items.length) return "";
                            return `Dia ${items[0].label}`;
                        },
                        label: function (context) {
                            return ` Gastos: ${formatBRL(context.raw)}`;
                        }
                    }
                }
            },

            scales: {
                x: {
                    border: {
                        display: false
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: "#9698a8",
                        font: {
                            size: 9
                        },
                        maxTicksLimit: 10,
                        padding: 6
                    }
                },

                y: {
                    beginAtZero: true,
                    border: {
                        display: false
                    },
                    grid: {
                        color: "rgba(150, 152, 168, 0.14)",
                        drawTicks: false
                    },
                    ticks: {
                        color: "#9698a8",
                        font: {
                            size: 10
                        },
                        padding: 8,
                        callback: function (value) {
                            return formatBRL(value);
                        }
                    }
                }
            }
        }
    });
}


/* =====================================================
   CATEGORIAS
===================================================== */

function renderCategories() {

    const container =
        $("categoryList");


    const expenses =
        getMonthExpenses(
            getCurrentMonthKey()
        );


    const total =
        totalExpenses(expenses);


    const data =
        Object.keys(categories)
            .map(name => {

                const categoryTotal =
                    expenses
                        .filter(
                            expense =>
                                expense.category === name
                        )
                        .reduce(
                            (sum, expense) =>
                                sum +
                                Number(
                                    expense.amount || 0
                                ),
                            0
                        );


                return {

                    name,

                    total:
                        categoryTotal,

                    icon:
                        categories[name].icon,

                    percent:
                        total > 0
                            ? (categoryTotal / total) * 100
                            : 0

                };

            });


    data.sort(
        (a, b) =>
            b.total - a.total
    );


    container.innerHTML =
        data.map(item => `

            <div class="category-row">

                <div class="category-icon">
                    ${item.icon}
                </div>

                <div class="category-name">
                    ${item.name}
                </div>

                <div class="category-bar">

                    <div
                        class="category-bar-fill"
                        style="width:${item.percent}%">

                    </div>

                </div>

                <div class="category-total">

                    ${formatBRL(item.total)}

                    <div class="category-percent">
                        ${item.percent.toFixed(1)}%
                    </div>

                </div>

            </div>

        `).join("");

}


/* =====================================================
   INSIGHTS
===================================================== */

function renderInsights() {

    const container =
        $("smartInsights");


    const current =
        getMonthExpenses(
            getCurrentMonthKey()
        );


    const previous =
        getMonthExpenses(
            getPreviousMonthKey()
        );


    const currentTotal =
        totalExpenses(current);


    const previousTotal =
        totalExpenses(previous);


    const insights = [];


    /*
     * Maior categoria
     */

    const categoryTotals = {};


    current.forEach(expense => {

        const category =
            expense.category ||
            "Outros";


        categoryTotals[category] =
            (categoryTotals[category] || 0) +
            Number(expense.amount || 0);

    });


    const biggestCategory =
        Object.entries(categoryTotals)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            )[0];


    if (biggestCategory) {

        insights.push({

            icon:
                categories[
                    biggestCategory[0]
                ]?.icon || "📦",

            title:
                "Categoria que mais pesa",

            text:
                `Você gastou ${formatBRL(biggestCategory[1])} ` +
                `com ${biggestCategory[0]} neste mês.`

        });

    }


    /*
     * Comparação
     */

    if (previousTotal > 0) {

        const difference =
            ((currentTotal - previousTotal) /
                previousTotal) * 100;


        if (difference > 5) {

            insights.push({

                icon:
                    "📈",

                title:
                    "Gastos aumentaram",

                text:
                    `Seu gasto está ${difference.toFixed(1)}% ` +
                    `acima do mês passado.`

            });

        } else if (difference < -5) {

            insights.push({

                icon:
                    "📉",

                title:
                    "Boa evolução",

                text:
                    `Você reduziu seus gastos em ` +
                    `${Math.abs(difference).toFixed(1)}% ` +
                    `em relação ao mês passado.`

            });

        } else {

            insights.push({

                icon:
                    "⚖️",

                title:
                    "Gastos estáveis",

                text:
                    "Seu nível de gastos está próximo ao mês anterior."

            });

        }

    } else {

        insights.push({

            icon:
                "📊",

            title:
                "Comece seu histórico",

            text:
                "Continue registrando suas despesas para receber análises melhores."

        });

    }


    /*
     * Limite
     */

    if (state.limit > 0) {

        const percentage =
            (currentTotal /
                state.limit) * 100;


        if (percentage >= 100) {

            insights.push({

                icon:
                    "🚨",

                title:
                    "Limite ultrapassado",

                text:
                    "Evite gastos não essenciais até reorganizar seu orçamento."

            });

        } else if (percentage >= 80) {

            insights.push({

                icon:
                    "⚠️",

                title:
                    "Atenção ao orçamento",

                text:
                    `Você já utilizou ${Math.round(percentage)}% do limite.`

            });

        } else {

            insights.push({

                icon:
                    "✅",

                title:
                    "Dentro do limite",

                text:
                    "Seus gastos ainda estão dentro do orçamento definido."

            });

        }

    }


    /*
     * Sem insights
     */

    if (!insights.length) {

        insights.push({

            icon:
                "💡",

            title:
                "Comece registrando",

            text:
                "Adicione suas despesas para receber insights personalizados."

        });

    }


    container.innerHTML =
        insights
            .slice(0, 3)
            .map(item => `

                <div class="insight">

                    <div class="insight-icon">
                        ${item.icon}
                    </div>

                    <strong>
                        ${item.title}
                    </strong>

                    <p>
                        ${item.text}
                    </p>

                </div>

            `)
            .join("");

}


function escapeInsightHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function extractAIInsightsJSON(text) {

    if (!text) {
        return null;
    }


    let cleaned = String(text)
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();


    try {

        const parsed = JSON.parse(cleaned);


        if (Array.isArray(parsed)) {
            return parsed;
        }

    } catch (error) {

        // Continua tentando encontrar o JSON dentro da resposta

    }


    const match = cleaned.match(/\[[\s\S]*\]/);


    if (!match) {
        return null;
    }


    try {

        const parsed = JSON.parse(match[0]);

        return Array.isArray(parsed)
            ? parsed
            : null;

    } catch (error) {
        return null;
    }
}


async function generateAIInsights() {

    const container = $("smartInsights");
    const button = $("generateAIInsights");

    if (!container || !button) {
        return;
    }

    const currentMonth = getCurrentMonthKey();
    const expenses = state.expenses.filter(expense =>
        expense.date && expense.date.startsWith(currentMonth)
    );

    const previousMonth = getPreviousMonthKey();
    const previousExpenses = state.expenses.filter(expense =>
        expense.date && expense.date.startsWith(previousMonth)
    );

    const total = expenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0), 0
    );

    const previousTotal = previousExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0), 0
    );

    const categoryTotals = {};
    expenses.forEach(expense => {
        const category = expense.category || "Outros";
        categoryTotals[category] =
            (categoryTotals[category] || 0) + Number(expense.amount || 0);
    });

    const sortedExpenses = [...expenses].sort(
        (a, b) => Number(b.amount || 0) - Number(a.amount || 0)
    );

    const biggestExpense = sortedExpenses[0] || null;
    const biggestCategory = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])[0] || null;

    const limit = Number(state.limit || 0);
    const remainingLimit = Math.max(limit - total, 0);
    const limitUsed = limit > 0 ? (total / limit) * 100 : 0;
    const averageExpense = expenses.length ? total / expenses.length : 0;

    const dailyRate = Number(state.income?.dailyRate || 0);
    const daysPerWeek = Number(state.income?.daysPerWeek || 0);
    const monthlyIncome = calculateMonthlyIncome();
    const monthlyExtraIncome = getMonthExtraIncome().reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const incomeRemaining = monthlyIncome - total;
    const incomeUsed = monthlyIncome > 0 ? (total / monthlyIncome) * 100 : 0;

    const goal = state.goal || null;
    const goalTarget = goal ? Number(goal.target || 0) : 0;
    const goalSaved = goal ? Number(goal.saved || goal.current || 0) : 0;
    const goalRemaining = Math.max(goalTarget - goalSaved, 0);
    const goalPercent = goalTarget > 0
        ? Math.min((goalSaved / goalTarget) * 100, 100)
        : 0;

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = Math.max(1, Math.min(now.getDate(), daysInMonth));
    const daysRemaining = Math.max(daysInMonth - dayOfMonth, 0);
    const dailyBudgetRemaining = daysRemaining > 0 && remainingLimit > 0
        ? remainingLimit / daysRemaining
        : 0;

    const expenseSummary = expenses.slice(0, 30).map(expense => ({
        description: expense.description || "Despesa",
        amount: Number(expense.amount || 0),
        category: expense.category || "Outros",
        date: expense.date || ""
    }));

    const prompt = `
Você é o consultor financeiro pessoal do FinUp.
Sua função é analisar os dados reais do usuário e dar recomendações
personalizadas, práticas e responsáveis para ajudá-lo a gastar melhor,
controlar o orçamento e avançar em sua meta.

DADOS DO USUÁRIO:
- Mês atual: ${currentMonth}
- Total gasto no mês: ${total.toFixed(2)}
- Quantidade de despesas: ${expenses.length}
- Gasto médio por despesa: ${averageExpense.toFixed(2)}
- Maior despesa: ${biggestExpense ? JSON.stringify({description: biggestExpense.description, amount: Number(biggestExpense.amount || 0), category: biggestExpense.category || "Outros"}) : "null"}
- Categoria que mais consumiu dinheiro: ${biggestCategory ? JSON.stringify({category: biggestCategory[0], amount: biggestCategory[1]}) : "null"}
- Gastos por categoria: ${JSON.stringify(categoryTotals)}
- Limite mensal: ${limit.toFixed(2)}
- Valor restante do limite: ${remainingLimit.toFixed(2)}
- Percentual do limite utilizado: ${limitUsed.toFixed(1)}%
- Dias restantes estimados no mês: ${daysRemaining}
- Valor médio disponível por dia até o fim do mês: ${dailyBudgetRemaining.toFixed(2)}
- Total gasto no mês anterior: ${previousTotal.toFixed(2)}
- Valor da diária: ${dailyRate.toFixed(2)}
- Dias trabalhados por semana: ${daysPerWeek}
- Dias de trabalho extra no mês: ${Number(state.income?.extraWorkDays || 0)}
- Faltas no mês: ${Number(state.income?.absences || 0)}
- Renda mensal estimada (trabalho + renda extra): ${monthlyIncome.toFixed(2)}
- Renda extra recebida no mês: ${monthlyExtraIncome.toFixed(2)}
- Valor restante estimado da renda após os gastos: ${incomeRemaining.toFixed(2)}
- Percentual da renda estimada já gasto: ${incomeUsed.toFixed(1)}%
- Meta financeira: ${goal ? JSON.stringify({name: goal.name, target: goalTarget, saved: goalSaved, remaining: goalRemaining, progressPercent: goalPercent.toFixed(1)}) : "null"}
- Despesas recentes: ${JSON.stringify(expenseSummary)}

REGRAS PARA A RECOMENDAÇÃO:
1. Use somente os dados fornecidos. Nunca invente salário, renda, contas,
   parcelas, frequência de compras ou outros fatos que não estejam nos dados.
2. Não faça diagnóstico financeiro nem dê conselho de investimento.
3. Seja específico. Sempre que possível, mencione valores, categorias ou
   a meta do usuário.
4. Não repita apenas os números: transforme a análise em uma ação prática.
5. Se houver uma categoria muito dominante, explique que ela merece atenção.
6. Se o limite estiver perto de acabar ou ultrapassado, recomende uma ação
   concreta para controlar os próximos gastos.
7. Se houver uma meta, conecte a recomendação aos gastos atuais e ao objetivo.
8. Se houver renda por diária cadastrada, use-a para transformar os gastos em recomendações práticas por semana ou mês.
9. Considere a renda extra separadamente da renda habitual e explique quando ela puder ajudar no saldo ou na meta.
10. Considere dias de trabalho extra e faltas ao avaliar a renda do mês.
11. Se não houver dados suficientes, diga isso claramente e recomende continuar
   registrando despesas.
10. Não use frases genéricas como "gaste menos" sem explicar COMO.
11. Gere exatamente 3 cards: um diagnóstico, uma recomendação prática e uma
    recomendação focada na meta ou no orçamento.
12. Escreva em português do Brasil, de forma curta, natural e amigável.
13. Retorne SOMENTE JSON válido, sem markdown e sem texto fora do JSON.

FORMATO OBRIGATÓRIO:
[
  {"icon":"📊","title":"Diagnóstico","text":"..."},
  {"icon":"💡","title":"Recomendação","text":"..."},
  {"icon":"🎯","title":"Próximo passo","text":"..."}
]
`;

    button.disabled = true;
    button.textContent = "Analisando...";

    container.innerHTML = `
        <div class="insight">
            <div class="insight-icon">⏳</div>
            <strong>Analisando seu perfil financeiro...</strong>
            <p>A IA está cruzando seus gastos, orçamento e meta para preparar uma recomendação personalizada.</p>
        </div>
    `;

    try {
        if (
            !window.puter ||
            !puter.ai ||
            typeof puter.ai.chat !== "function"
        ) {
            throw new Error("Puter AI não está disponível.");
        }

        const response = await puter.ai.chat(
            prompt,
            false,
            { model: "gpt-5.6-luna" }
        );

        const text = extractAIText(response);
        const insights = extractAIInsightsJSON(text);

        if (!insights || !insights.length) {
            throw new Error("A IA não retornou um JSON válido.");
        }

        const validInsights = insights
            .filter(item =>
                item &&
                typeof item.title === "string" &&
                typeof item.text === "string"
            )
            .slice(0, 3);

        if (validInsights.length === 0) {
            throw new Error("Nenhum insight válido foi encontrado.");
        }

        container.innerHTML = validInsights.map(item => `
            <div class="insight">
                <div class="insight-icon">
                    ${escapeInsightHTML(item.icon || "💡")}
                </div>
                <strong>${escapeInsightHTML(item.title)}</strong>
                <p>${escapeInsightHTML(item.text)}</p>
            </div>
        `).join("");

        showToast("Recomendação personalizada gerada pela IA.");

    } catch (error) {
        console.error("Erro ao gerar insights com IA:", error);
        renderInsights();
        showToast("Não foi possível gerar a recomendação com IA.");
    } finally {
        button.disabled = false;
        button.innerHTML = '<span class="ai-button-icon" aria-hidden="true">✦</span><span>Gerar recomendação</span>';
    }
}

/* =====================================================
   RECENTES
===================================================== */

function renderRecentExpenses() {

    const container =
        $("recentExpenses");


    const expenses =
        getMonthExpenses(
            getCurrentMonthKey()
        )
            .sort(
                (a, b) =>
                    new Date(b.date) -
                    new Date(a.date)
            )
            .slice(0, 6);


    if (!expenses.length) {

        container.innerHTML = `

            <div class="empty-state">

                <strong>
                    Nenhuma despesa registrada
                </strong>

                <span>
                    Clique em "Nova despesa" para começar.
                </span>

            </div>

        `;

        return;

    }


    container.innerHTML =
        expenses.map(expense => `

            <div class="recent-item">

                <div class="recent-icon">

                    ${categories[
                expense.category
            ]?.icon || "📦"
            }

                </div>

                <div class="recent-info">

                    <strong>
                        ${escapeHTML(
                expense.description
            )}
                    </strong>

                    <span>
                        ${escapeHTML(
                expense.category
            )
            }
                        •
                        ${formatDate(expense.date)}
                    </span>

                </div>

                <div class="recent-value">

                    ${formatBRL(
                expense.amount
            )}

                </div>

            </div>

        `).join("");

}


/* =====================================================
   TABELA DE DESPESAS
===================================================== */

function renderExpenseTable() {

    const container =
        $("expenseTable");


    const search =
        $("searchExpense")
            ?.value
            .trim()
            .toLowerCase() || "";


    const category =
        $("filterCategory")
            ?.value || "";


    let expenses =
        getMonthExpenses(
            getCurrentMonthKey()
        );


    if (search) {

        expenses =
            expenses.filter(
                expense =>
                    String(
                        expense.description
                    )
                        .toLowerCase()
                        .includes(search)
            );

    }


    if (category) {

        expenses =
            expenses.filter(
                expense =>
                    expense.category === category
            );

    }


    expenses.sort(
        (a, b) =>
            new Date(b.date) -
            new Date(a.date)
    );


    if (!expenses.length) {

        container.innerHTML = `

            <tr>

                <td
                    colspan="5"
                    class="empty-state">

                    <strong>
                        Nenhuma despesa encontrada
                    </strong>

                    <span>
                        Tente alterar os filtros ou adicione uma nova despesa.
                    </span>

                </td>

            </tr>

        `;

        return;

    }


    container.innerHTML =
        expenses.map(expense => `

            <tr>

                <td>

                    <strong>
                        ${escapeHTML(
            expense.description
        )}
                    </strong>

                    ${expense.note
                ? `
                                <div style="
                                    color:var(--muted);
                                    font-size:10px;
                                    margin-top:3px;
                                ">
                                    ${escapeHTML(
                    expense.note
                )}
                                </div>
                              `
                : ""
            }

                </td>


                <td>

                    <span class="category-badge">

                        ${categories[
                expense.category
            ]?.icon || "📦"
            }

                        ${escapeHTML(
                expense.category
            )}

                    </span>

                </td>


                <td>
                    ${formatDate(expense.date)}
                </td>


                <td>

                    <strong>
                        ${formatBRL(
                expense.amount
            )}
                    </strong>

                </td>


                <td>

                    <button
                        class="delete-expense"
                        data-id="${expense.id}"
                        title="Excluir">

                        🗑

                    </button>

                </td>

            </tr>

        `).join("");

}


/* =====================================================
   ADICIONAR DESPESA
===================================================== */

async function addExpense(event) {

    event.preventDefault();


    const description =
        $("expenseDescription")
            .value
            .trim();


    const amount =
        Number(
            $("expenseAmount").value
        );


    const date =
        $("expenseDate").value;


    const category =
        $("expenseCategory").value;


    const note =
        $("expenseNote")
            .value
            .trim();


    if (!description) {

        showToast(
            "Informe a descrição.",
            "error"
        );

        return;

    }


    if (!amount || amount <= 0) {

        showToast(
            "Informe um valor válido.",
            "error"
        );

        return;

    }


    if (!date) {

        showToast(
            "Informe a data.",
            "error"
        );

        return;

    }


    const expense = {

        id:
            generateId(),

        description,

        amount,

        date,

        category,

        note,

        createdAt:
            new Date().toISOString()

    };


    state.expenses.push(
        expense
    );


    const saved =
        await saveUserData();


    if (!saved) {

        return;

    }


    closeModal("expenseModal");

    $("expenseForm").reset();

    $("expenseDate").value =
        new Date()
            .toISOString()
            .slice(0, 10);


    $("aiResult").textContent =
        "";


    render();


    showToast(
        "Despesa adicionada com sucesso.",
        "success"
    );

}


/* =====================================================
   EXCLUIR DESPESA
===================================================== */

async function deleteExpense(id) {

    const expense =
        state.expenses.find(
            item =>
                item.id === id
        );


    if (!expense) {
        return;
    }


    const confirmed =
        confirm(
            `Excluir "${expense.description}"?`
        );


    if (!confirmed) {
        return;
    }


    state.expenses =
        state.expenses.filter(
            item =>
                item.id !== id
        );


    await saveUserData();

    render();


    showToast(
        "Despesa excluída.",
        "success"
    );

}


/* =====================================================
   META
===================================================== */

async function saveGoal(event) {
    event.preventDefault();

    const name = $("goalName").value.trim();
    const target = Number($("goalTarget").value);
    const saved = Number($("goalSaved").value) || 0;
    const startDate = $("goalStartDate")?.value || new Date().toISOString().slice(0, 10);
    const endDate = $("goalEndDate")?.value || "";

    if (!name) return showToast("Informe o nome da meta.", "error");
    if (!target || target <= 0) return showToast("Informe um valor válido para a meta.", "error");
    if (saved < 0) return showToast("O valor guardado não pode ser negativo.", "error");
    if (endDate && startDate > endDate) return showToast("A data final deve ser igual ou posterior à data de início.", "error");

    if (!Array.isArray(state.goals)) state.goals = [];

    const goalData = {
        name, target, saved, startDate, endDate
    };

    const editingGoal = Boolean(currentGoalId);
    if (currentGoalId) {
        const index = state.goals.findIndex(g => g.id === currentGoalId);
        if (index >= 0) {
            state.goals[index] = { ...state.goals[index], ...goalData };
            state.goal = state.goals[index];
        }
    } else {
        const newGoal = { id: `goal_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, ...goalData };
        state.goals.unshift(newGoal);
        state.goal = newGoal;
    }

    currentGoalId = state.goal.id;
    await saveUserData();
    render();
    resetGoalForm();
    showToast(editingGoal ? "Meta atualizada com sucesso." : "Meta criada com sucesso.", "success");
}

async function deleteGoal(goalId = currentGoalId || state.goal?.id) {
    if (!goalId) return showToast("Não existe uma meta para excluir.", "error");
    const goal = (state.goals || []).find(g => g.id === goalId);
    if (!goal) return;
    if (!confirm(`Deseja excluir a meta "${goal.name}"?`)) return;

    state.goals = (state.goals || []).filter(g => g.id !== goalId);
    state.goal = state.goals[0] || null;
    currentGoalId = null;
    await saveUserData();
    render();
    resetGoalForm();
    showToast("Meta excluída.", "success");
}

function resetGoalForm() {
    currentGoalId = null;
    if ($("goalName")) $("goalName").value = "";
    if ($("goalTarget")) $("goalTarget").value = "";
    if ($("goalSaved")) $("goalSaved").value = "";
    if ($("goalStartDate")) $("goalStartDate").value = "";
    if ($("goalEndDate")) $("goalEndDate").value = "";
    const submit = $("goalForm")?.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "Salvar meta";
}

function editGoal(goalId) {
    const goal = (state.goals || []).find(g => g.id === goalId);
    if (!goal) return;
    state.goal = goal;
    currentGoalId = goal.id;
    $("goalName").value = goal.name || "";
    $("goalTarget").value = goal.target || "";
    $("goalSaved").value = goal.saved || "";
    $("goalStartDate").value = goal.startDate || "";
    $("goalEndDate").value = goal.endDate || "";
    const submit = $("goalForm")?.querySelector('button[type="submit"]');
    if (submit) submit.textContent = "Atualizar meta";
    $("goalName")?.focus();
}

function calculateGoalDaily(goal) {
    const target = Number(goal.target || 0);
    const saved = Number(goal.saved || 0);
    const remaining = Math.max(target - saved, 0);
    if (remaining <= 0 || !goal.endDate) return 0;
    const today = new Date(); today.setHours(0,0,0,0);
    const start = new Date(`${goal.startDate || today.toISOString().slice(0,10)}T00:00:00`);
    const end = new Date(`${goal.endDate}T00:00:00`);
    const from = start > today ? start : today;
    const days = Math.max(0, Math.ceil((end - from) / 86400000) + 1);
    return days > 0 ? remaining / days : 0;
}

function formatGoalDate(value) {
    return value ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T00:00:00`)) : "Não definida";
}

function renderGoal() {
    const display = $("goalDisplay");
    const mini = $("goalMini");
    const goals = Array.isArray(state.goals) ? state.goals : [];

    if (!goals.length) {
        state.goal = null;
        resetGoalForm();
        display.innerHTML = `<div class="goal-empty"><div>🎯</div><strong>Nenhuma meta configurada</strong><span>Crie uma nova meta para acompanhar seu objetivo financeiro.</span></div>`;
        mini.innerHTML = `<div class="empty-goal"><div>🎯</div><strong>Nenhuma meta criada</strong><button id="createGoalFromDashboard" class="text-button">Criar meta →</button></div>`;
        attachGoalDashboardButton();
        return;
    }

    state.goal = goals.find(g => g.id === state.goal?.id) || goals[0];
    const active = state.goal;
    if (!currentGoalId) {
        $("goalName").value = active.name || "";
        $("goalTarget").value = active.target || "";
        $("goalSaved").value = active.saved || "";
        $("goalStartDate").value = active.startDate || "";
        $("goalEndDate").value = active.endDate || "";
    }

    const cards = goals.map(goal => {
        const target = Number(goal.target || 0);
        const saved = Number(goal.saved || 0);
        const remaining = Math.max(target - saved, 0);
        const percent = target > 0 ? Math.min(saved / target * 100, 100) : 0;
        const daily = calculateGoalDaily(goal);
        const isActive = goal.id === active.id;
        return `<article class="goal-item ${isActive ? 'is-active' : ''}">
            <div class="goal-item-head"><div><span class="goal-item-icon">🎯</span><div><strong>${escapeHTML(goal.name)}</strong><small>Meta de ${formatBRL(target)}</small></div></div><span>${percent.toFixed(1)}%</span></div>
            <div class="goal-progress"><div class="goal-progress-fill" style="width:${percent}%"></div></div>
            <div class="goal-item-meta"><span>💰 ${formatBRL(saved)} guardados</span><span>Faltam ${formatBRL(remaining)}</span></div>
            <div class="goal-item-dates"><span>📅 ${formatGoalDate(goal.startDate)}</span><span>🏁 ${formatGoalDate(goal.endDate)}</span></div>
            <div class="goal-item-footer"><span>💡 Guardar por dia: <strong>${daily > 0 ? formatBRL(daily) : remaining <= 0 ? 'Meta alcançada' : '—'}</strong></span><div><button type="button" class="secondary-button goal-edit-btn" data-goal-id="${goal.id}">Editar</button><button type="button" class="danger-button goal-delete-btn" data-goal-id="${goal.id}">Excluir</button></div></div>
        </article>`;
    }).join('');

    display.innerHTML = `<div class="goals-list">${cards}</div>`;
    display.querySelectorAll('.goal-edit-btn').forEach(btn => btn.addEventListener('click', () => editGoal(btn.dataset.goalId)));
    display.querySelectorAll('.goal-delete-btn').forEach(btn => btn.addEventListener('click', () => deleteGoal(btn.dataset.goalId)));

    const target = Number(active.target || 0);
    const saved = Number(active.saved || 0);
    const percent = target > 0 ? Math.min(saved / target * 100, 100) : 0;
    mini.innerHTML = `<div style="width:100%"><div class="mini-goal-name">${escapeHTML(active.name)}</div><div class="mini-goal-values"><span>${formatBRL(saved)} guardados</span><span>${formatBRL(target)}</span></div><div class="goal-progress"><div class="goal-progress-fill" style="width:${percent}%"></div></div><div class="goal-percent">${percent.toFixed(1)}% concluído</div></div>`;
}


/* =====================================================
   BOTÃO DE CRIAR META
===================================================== */

function attachGoalDashboardButton() {

    const button =
        $("createGoalFromDashboard");


    if (!button) {
        return;
    }


    button.addEventListener(
        "click",
        () => {

            switchView("goals");

        }
    );

}


/* =====================================================
   RECIBO — IA
===================================================== */

function extractAIText(response) {

    if (
        typeof response === "string"
    ) {

        return response;

    }


    if (
        response?.message?.content
    ) {

        const content =
            response.message.content;


        if (
            typeof content === "string"
        ) {

            return content;

        }


        if (
            Array.isArray(content)
        ) {

            return content
                .map(item => {

                    if (
                        typeof item === "string"
                    ) {

                        return item;

                    }

                    return (
                        item?.text ||
                        item?.content ||
                        ""
                    );

                })
                .join(" ");

        }

    }


    return (
        response?.text ||
        response?.content ||
        ""
    );

}


function extractJSON(text) {

    if (!text) {
        return null;
    }


    let cleaned =
        text
            .replace(
                /```json/gi,
                ""
            )
            .replace(
                /```/g,
                ""
            )
            .trim();


    try {

        return JSON.parse(
            cleaned
        );

    } catch (error) {

        const match =
            cleaned.match(
                /\{[\s\S]*\}/
            );


        if (!match) {
            return null;
        }


        try {

            return JSON.parse(
                match[0]
            );

        } catch (secondError) {

            return null;

        }

    }

}


/* =====================================================
   SELETOR DE ARQUIVO DO RECIBO
===================================================== */

document.addEventListener("DOMContentLoaded", function () {
    const receiptFile = document.getElementById("receiptFile");
    const receiptFileName = document.getElementById("receiptFileName");

    if (receiptFile && receiptFileName) {
        receiptFile.addEventListener("change", function () {
            receiptFileName.textContent = this.files && this.files.length
                ? this.files[0].name
                : "Nenhum arquivo escolhido";
        });
    }
});


async function readReceipt() {

    const file =
        $("receiptFile")
            .files[0];


    if (!file) {

        showToast(
            "Selecione uma imagem do recibo.",
            "error"
        );

        return;

    }


    if (
        !file.type.startsWith("image/")
    ) {

        showToast(
            "Envie uma imagem.",
            "error"
        );

        return;

    }


    /*
     * O Puter img2txt trabalha com
     * imagens de até 10 MB.
     */

    if (
        file.size >
        10 * 1024 * 1024
    ) {

        showToast(
            "A imagem deve ter no máximo 10 MB.",
            "error"
        );

        return;

    }


    const result =
        $("aiResult");


    result.textContent =
        "⏳ Lendo o recibo...";


    try {

        /*
         * Primeiro fazemos OCR.
         *
         * Isso evita depender da conversão
         * automática para image_url.
         */

        const ocrText =
            await puter.ai.img2txt(
                file
            );


        if (!ocrText) {

            throw new Error(
                "Não foi possível extrair texto do recibo."
            );

        }


        result.textContent =
            "✦ Texto identificado. A IA está organizando os dados...";


        const prompt = `

Você é um assistente financeiro.

Analise o texto extraído de um recibo/cupom fiscal.

Extraia somente estas informações:

{
  "establishment": "nome do estabelecimento",
  "date": "data no formato YYYY-MM-DD",
  "total": 0,
  "category": "Alimentação",
  "description": "descrição curta da compra"
}

Categorias permitidas:

Alimentação
Transporte
Moradia
Lazer
Saúde
Educação
Compras
Outros

REGRAS:

- Retorne SOMENTE JSON válido.
- "total" deve ser número.
- Se a data não puder ser identificada, use "".
- Se o estabelecimento não puder ser identificado, use "".
- Escolha a categoria mais adequada.
- Não invente informações.

Texto extraído:

${ocrText}

        `;


        const response =
            await puter.ai.chat(
                prompt,
                false,
                {
                    model:
                        "gpt-5.6-luna"
                }
            );


        const text =
            extractAIText(
                response
            );


        const data =
            extractJSON(text);


        if (!data) {

            throw new Error(
                "A IA não retornou um JSON válido."
            );

        }


        /*
         * Preenche o formulário.
         */

        if (data.description) {

            $("expenseDescription")
                .value =
                data.description;

        } else if (data.establishment) {

            $("expenseDescription")
                .value =
                data.establishment;

        }


        if (
            data.total !== undefined &&
            Number(data.total) > 0
        ) {

            $("expenseAmount")
                .value =
                Number(data.total);

        }


        if (data.date) {

            /*
             * Confere se a data tem formato válido.
             */

            if (
                /^\d{4}-\d{2}-\d{2}$/
                    .test(data.date)
            ) {

                $("expenseDate")
                    .value =
                    data.date;

            }

        }


        if (
            categories[
            data.category
            ]
        ) {

            $("expenseCategory")
                .value =
                data.category;

        }


        $("expenseNote")
            .value =
            data.establishment
                ? `Estabelecimento: ${data.establishment}`
                : "";


        result.innerHTML = `
            <strong style="color:var(--green)">
                ✓ Recibo processado.
            </strong>
            Confira os dados antes de salvar.
        `;


        showToast(
            "Recibo lido com sucesso.",
            "success"
        );


    } catch (error) {

        console.error(
            "Erro na leitura do recibo:",
            error
        );


        result.innerHTML = `
            <strong style="color:var(--red)">
                Não foi possível ler o recibo.
            </strong>
            Tente uma foto mais nítida.
        `;


        showToast(
            "Erro ao processar o recibo.",
            "error"
        );

    }

}


/* =====================================================
   MODAIS
===================================================== */

function openModal(id) {

    const modal =
        $(id);


    if (!modal) {
        return;
    }


    modal.classList.remove(
        "hidden"
    );

}


function closeModal(id) {

    const modal =
        $(id);


    if (!modal) {
        return;
    }


    modal.classList.add(
        "hidden"
    );

}


/* =====================================================
   LIMITE
===================================================== */

function openLimitModal() {

    $("limitInput").value =
        state.limit || "";


    openModal(
        "limitModal"
    );

}


async function saveLimit(event) {

    event.preventDefault();


    const value =
        Number(
            $("limitInput").value
        );


    if (
        Number.isNaN(value) ||
        value < 0
    ) {

        showToast(
            "Informe um limite válido.",
            "error"
        );

        return;

    }


    state.limit =
        value;


    await saveUserData();

    closeModal(
        "limitModal"
    );

    render();


    showToast(
        "Limite atualizado.",
        "success"
    );

}


/* =====================================================
   NAVEGAÇÃO DE MÊS
===================================================== */

function changeMonth(amount) {

    const date =
        new Date(
            state.viewDate +
            "T12:00:00"
        );


    date.setMonth(
        date.getMonth() + amount
    );


    state.viewDate =
        `${date.getFullYear()}-${String(
            date.getMonth() + 1
        ).padStart(2, "0")}-01`;


    render();

}


/* =====================================================
   NOVA DESPESA
===================================================== */

function openExpenseModal() {

    $("expenseForm").reset();


    $("expenseDate").value =
        new Date()
            .toISOString()
            .slice(0, 10);


    $("aiResult").textContent =
        "";


    openModal(
        "expenseModal"
    );

}


/* =====================================================
   TOAST
===================================================== */

function showToast(
    message,
    type = "success"
) {

    const container =
        $("toastContainer");


    const toast =
        document.createElement(
            "div"
        );


    toast.className =
        `toast ${type}`;


    toast.textContent =
        message;


    container.appendChild(
        toast
    );


    setTimeout(
        () => {

            toast.remove();

        },
        3500
    );

}


/* =====================================================
   EVENTOS
===================================================== */

function setupEvents() {

    /*
     * Login
     */

    $("loginButton")
        .addEventListener(
            "click",
            login
        );

    const createAccountButton = $("createAccountButton");
    if (createAccountButton) {
        createAccountButton.addEventListener("click", async () => {
            try {
                if (!window.puter || !puter.auth) {
                    showToast("Puter não foi carregado.", "error");
                    return;
                }

                /*
                 * O Puter fornece a autenticação da conta.
                 * Não armazenamos senhas dentro do FinUp.
                 */
                // Abre o fluxo normal do Puter, que permite criar uma conta
                // permanente ou entrar em uma conta existente.
                // Não usamos attempt_temp_user_creation aqui porque isso cria
                // uma conta temporária e não é o fluxo desejado pelo botão
                // "Criar minha conta".
                await puter.auth.signIn();
                await bootSignedUser();
            } catch (error) {
                console.error("Erro na autenticação Puter:", error);
                const msg = error?.msg || error?.message || "Não foi possível criar/entrar na conta.";
                showToast(msg, "error");
            }
        });
    }


    /*
     * Logout
     */

    $("logoutButton")
        .addEventListener(
            "click",
            logout
        );

    const topbarLogoutButton = $("topbarLogoutButton");
    if (topbarLogoutButton) {
        topbarLogoutButton.addEventListener("click", async () => {
            const confirmed = window.confirm("Deseja sair da sua conta do FinUp?");
            if (confirmed) {
                await logout();
            }
        });
    }


    /*
     * Navegação
     */

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    switchView(
                        button.dataset.view
                    );

                }
            );

        });


    /*
     * Mês
     */

    $("previousMonth")
        .addEventListener(
            "click",
            () => changeMonth(-1)
        );


    $("nextMonth")
        .addEventListener(
            "click",
            () => changeMonth(1)
        );


    $("addExpensePage")
        .addEventListener(
            "click",
            openExpenseModal
        );


    /*
     * Form despesa
     */

    $("expenseForm")
        .addEventListener(
            "submit",
            addExpense
        );


    /*
     * Recibo
     */

    $("readReceipt")
        .addEventListener(
            "click",
            readReceipt
        );


    /*
     * Limite
     */

    $("editLimitButton")
        .addEventListener(
            "click",
            openLimitModal
        );


    $("limitForm")
        .addEventListener(
            "submit",
            saveLimit
        );


    /*
     * Renda por diária
     */

    $("incomeForm")
        .addEventListener(
            "submit",
            saveIncome
        );

    const extraIncomeForm = $("extraIncomeForm");
    if (extraIncomeForm) {
        extraIncomeForm.addEventListener("submit", addExtraIncome);
    }

    ["extraWorkDaysInput", "absencesInput"].forEach(id => {
        const input = $(id);
        if (input) {
            input.addEventListener("input", async () => {
                const value = Math.max(0, Math.floor(Number(input.value || 0)));
                input.value = value;
                state.income = {
                    dailyRate: Number($("dailyRateInput")?.value || state.income?.dailyRate || 0),
                    daysPerWeek: Number($("daysPerWeekInput")?.value || state.income?.daysPerWeek || 0),
                    extraWorkDays: Math.max(0, Math.floor(Number($("extraWorkDaysInput")?.value || 0))),
                    absences: Math.max(0, Math.floor(Number($("absencesInput")?.value || 0)))
                };
                renderIncome();
                await saveUserData();
            });
        }
    });


    /*
     * Meta
     */

    $("goalForm")
        .addEventListener(
            "submit",
            saveGoal
        );


    $("deleteGoal")
        .addEventListener(
            "click",
            () => deleteGoal(currentGoalId || state.goal?.id)
        );

    const newGoalButton = $("newGoalButton");
    if (newGoalButton) newGoalButton.addEventListener("click", resetGoalForm);


    /*
     * Insights com IA
     */

    const aiButton =
        $("generateAIInsights");


    if (aiButton) {

        aiButton.addEventListener(
            "click",
            generateAIInsights
        );
    }


    /*
     * Ver despesas
     */

    $("viewAllExpenses")
        .addEventListener(
            "click",
            () => {

                switchView(
                    "expenses"
                );

            }
        );


    /*
     * Pesquisa
     */

    $("searchExpense")
        .addEventListener(
            "input",
            renderExpenseTable
        );


    /*
     * Filtro
     */

    $("filterCategory")
        .addEventListener(
            "change",
            renderExpenseTable
        );


    /*
     * Exclusão da tabela
     */

    $("expenseTable")
        .addEventListener(
            "click",
            event => {

                const button =
                    event.target.closest(
                        ".delete-expense"
                    );


                if (!button) {
                    return;
                }


                deleteExpense(
                    button.dataset.id
                );

            }
        );


    /*
     * Fechar modais
     */

    document
        .querySelectorAll(
            "[data-close]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    closeModal(
                        button.dataset.close
                    );

                }
            );

        });


    /*
     * Clique no fundo do modal
     */

    document
        .querySelectorAll(".modal")
        .forEach(modal => {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target === modal
                    ) {

                        closeModal(
                            modal.id
                        );

                    }

                }
            );

        });


    /*
     * ESC
     */

    document
        .addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Escape"
                ) {

                    document
                        .querySelectorAll(
                            ".modal:not(.hidden)"
                        )
                        .forEach(modal => {

                            closeModal(
                                modal.id
                            );

                        });

                }

            }
        );

}


/* =====================================================
   INICIALIZAÇÃO
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupEvents();

        boot();

    }
);
/* =====================================================
   ATALHOS DO DASHBOARD
===================================================== */
function setupQuickActions() {
    const addExpense = $("quickAddExpense");
    const newGoal = $("quickNewGoal");
    const income = $("quickIncome");

    if (addExpense) addExpense.addEventListener("click", openExpenseModal);
    if (newGoal) newGoal.addEventListener("click", () => {
        switchView("goals");
        resetGoalForm();
    });
    if (income) income.addEventListener("click", () => switchView("income"));
}

setupQuickActions();
