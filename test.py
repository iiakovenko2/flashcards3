from manim import *

class FlashcardScene(Scene):
    def construct(self):
        # Everything here uses native Mac fonts. No LaTeX. Zero crashes.
        title = Text("ფუნქციის გრაფიკის კვეთა y ღერძთან : f(x) = x² + 1", font="Helvetica", font_size=30)
        title.to_edge(UP)
        
        ax = Axes(x_range=[-3, 3], y_range=[-1, 5])
        func = ax.plot(lambda x: x**2 + 1, color=BLUE)
        
        self.play(Write(title))
        self.play(Create(ax), Create(func))
        self.wait(2)