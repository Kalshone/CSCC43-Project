# Compiler
CXX = g++

# Compiler flags
CXXFLAGS = -std=c++17 -Wall -O3
INCLUDES = -I/opt/homebrew/include

# Use pkg-config to get correct flags
PKGCONFIG = pkg-config
LIBS = $(shell $(PKGCONFIG) --libs libpqxx libpq)
CXXFLAGS += $(shell $(PKGCONFIG) --cflags libpqxx libpq)

# Source files
SRCS = pgsample.cpp

# Output executable
TARGET = pgsample

# Default target
all: $(TARGET)

# Rule to build the target executable
$(TARGET): $(SRCS)
	$(CXX) $(CXXFLAGS) $(INCLUDES) -o $(TARGET) $(SRCS) $(LIBS)

# Clean rule to remove the compiled executable
clean:
	rm -f $(TARGET)
