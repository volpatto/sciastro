---
id: scientific-writing
title: Escrita científica em Markdown
description: Uma página inteira com matemática, figuras, referências e código.
paths: {pt: noticias/escrita-cientifica/}
parent: news
layout: article
date: 2026-09-22
authors: [Equipe SciAstro]
tags: [Markdown, Computação científica]
---

Uma nota de pesquisa pode reunir a formulação matemática, o procedimento
computacional e seus resultados. Este exemplo usa a regra dos trapézios
composta [@davis1984].

## Formulação

Para $f(x)=e^{-x}$, a integral tem solução analítica. A referência
$\eqref{eq:integral}$ funciona mesmo antes de apresentar a equação:

\begin{equation}
I = \int_0^1 e^{-x}\,\mathrm{d}x = 1-e^{-1}.
\label{eq:integral}
\end{equation}

Em uma malha uniforme, com $h=1/n$, a aproximação é

\begin{equation}
T_n = h\left[\frac{f(0)+f(1)}{2}+\sum_{i=1}^{n-1}f(ih)\right].
\label{eq:trapezoid}
\end{equation}

::: note title="Hipóteses de regularidade"
Se $f$ tem derivada segunda contínua no intervalo, o erro global é
$\mathcal{O}(h^2)$. Essa conclusão não se aplica automaticamente a funções
descontínuas ou singulares.
:::

## Implementação

```python filename="quadratura.py"
from math import exp

def trapezoid(n):
    h = 1 / n
    return h * ((1 + exp(-1)) / 2
                + sum(exp(-i * h) for i in range(1, n)))

for n in (8, 16, 32, 64):
    print(n, abs(trapezoid(n) - (1 - exp(-1))))
```

::: tip title="Resultados reproduzíveis"
O [notebook completo](page:quadrature) reúne os mesmos cálculos
com uma tabela e um gráfico. Os resultados publicados são os salvos no arquivo.
:::

## Resultados

A tendência de segunda ordem é ilustrada em @ref(fig:convergence).

::: figure caption="Erro absoluto da regra dos trapézios; referência proporcional a h²." label="fig:convergence" width="85%" align="center" numbered=true
![Erro decrescente em escala logarítmica](/images/convergence.svg)
:::

::: table caption="Erro absoluto e razão entre erros em refinamentos sucessivos." label="tab:errors" numbered=true
| Subintervalos | Erro absoluto | Razão |
| ---: | ---: | ---: |
| 8 | 8.2286 × 10⁻⁴ | — |
| 16 | 2.0576 × 10⁻⁴ | 3.9992 |
| 32 | 5.1441 × 10⁻⁵ | 3.9998 |
| 64 | 1.2860 × 10⁻⁵ | 4.0000 |
:::

A @ref(tab:errors) fornece os valores correspondentes ao gráfico.

::: warning title="Interpretação do erro"
Este teste verifica uma quadratura em um problema com solução conhecida.
Ele não demonstra a validade física de um modelo mais complexo.
:::

::: details title="Uma equação sem numeração"
O delimitador duplo mantém a fórmula destacada sem incrementar o contador:

$$
\lim_{h\to 0} \frac{|I-T_n|}{h^2} = \frac{1-e^{-1}}{12}.
$$
:::
