---
id: integration
title: Integração numérica
description: Regra dos trapézios, implementação em Python e verificação do erro.
paths: {pt: aulas/integracao/}
parent: lessons
layout: article
numberSections: true
tags: [Quadratura, Python]
---

## Aproximando uma integral {#metodo}

Considere uma função suave $f$ em $[a,b]$. Divida o intervalo em $n$
subintervalos uniformes, com $h=(b-a)/n$ e $x_i=a+ih$.
A regra composta dos trapézios é

\begin{equation}
T_n = h\left[\frac{f(a)+f(b)}{2}+\sum_{i=1}^{n-1}f(x_i)\right].
\label{eq:trapezoid}
\end{equation}

A expressão $\eqref{eq:trapezoid}$ aproxima cada trecho da curva por um segmento
de reta. Para $f\in C^2([a,b])$, o erro global é de ordem $h^2$.

::: note title="Hipóteses importam"
A estimativa de segunda ordem pressupõe suavidade suficiente. Ela não deve ser
aplicada automaticamente a integrandos com singularidades ou descontinuidades.
:::

## Implementação

```python title="trapezoid.py"
def trapezoid(f, a, b, n):
    if not isinstance(n, int) or isinstance(n, bool) or n < 1:
        raise ValueError("n must be a positive integer")
    h = (b - a) / n
    interior = sum(f(a + i * h) for i in range(1, n))
    return h * (0.5 * f(a) + interior + 0.5 * f(b))


approximation = trapezoid(lambda x: x * x, 0.0, 1.0, 4)
print(approximation)  # 0.34375
```

## Um caso verificável {#verificacao}

Para $f(x)=x^2$ no intervalo $[0,1]$, a integral exata é $1/3$. Neste caso,
em aritmética exata,

\begin{equation}
T_n-\frac{1}{3}=\frac{1}{6n^2}.
\label{eq:error}
\end{equation}

Assim, duplicar $n$ divide o erro por quatro. A tabela usa a expressão analítica
do erro; valores em ponto flutuante podem diferir nas últimas casas decimais.

::: table caption="Erro exato da regra dos trapézios para x² em [0,1]." label="tab:errors"
| Subintervalos $n$ | Erro $T_n-1/3$ |
| ---: | ---: |
| 1 | $1/6$ |
| 2 | $1/24$ |
| 4 | $1/96$ |
| 8 | $1/384$ |
:::

Use @ref(tab:errors) para conferir os resultados do
[notebook complementar](page:trapezoid-notebook).

::: plotly src="plots/integration.json" caption="A função x² e a interpolação linear usada por quatro trapézios em [0,1]." label="fig:interactive" numbered=true
:::

Em @ref(fig:interactive), passe o cursor sobre os dados para inspecionar os
valores ou use as ferramentas do gráfico para ampliar uma região. A área sob
os segmentos de reta corresponde a $T_4=0.34375$.

## Exercícios {#exercicios}

1. Implemente o método e verifique o erro para $n=1,2,4,8$.
2. Calcule a razão entre os erros de duas malhas consecutivas.
3. Troque o integrando por $f(x)=x$. Explique o resultado antes de executar.

::: details title="Conferência do terceiro exercício"
A regra dos trapézios integra funções afins exatamente em aritmética exata.
Para $f(x)=x$ em $[0,1]$, o resultado esperado é $1/2$ para qualquer $n\geq1$.
:::

Volte ao [índice de aulas](page:lessons) ou consulte o
[programa](page:syllabus#objetivos).
